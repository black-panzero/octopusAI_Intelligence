"""
Chat service — orchestrates the LLM + tool-calling loop.

Supports any OpenAI-compatible provider (Groq, OpenRouter, OpenAI). Selects
the right base URL from `settings.llm_provider` unless `settings.llm_base_url`
is set explicitly.
"""
import json
from typing import Any

import structlog
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models.user import User
from app.services.ai.tools import TOOL_SCHEMAS, execute_tool

logger = structlog.get_logger(__name__)


PROVIDER_BASE_URLS = {
    "groq": "https://api.groq.com/openai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "openai": "https://api.openai.com/v1",
}

SYSTEM_PROMPT = """You are SmartBuy's AI shopping assistant for Kenya.

You help users:
  * find products across Kenyan merchants (Naivas, Carrefour, Quickmart, Chandarana)
  * compare prices, ratings and specs
  * add items to their universal cart at the cheapest merchant
  * set price-drop alerts or auto-buy rules

All prices are in Kenyan Shillings (KES). Always call `search_products` before
answering a product question — never invent prices or merchants. When the user
asks to compare specific products you have already searched, call
`compare_products` with their ids. When they want to add something, call
`add_to_cart` with the exact product_id and merchant_id from the search result.

If the catalog has no match, say so and suggest broader search terms — do NOT
fabricate products.

RESPONSE STYLE — READ CAREFULLY:
  * Reply in short, plain prose. One or two sentences is usually enough.
  * DO NOT repeat tool output as a markdown table, bullet list of items,
    or ASCII table. The UI already renders every tool result as a rich,
    interactive widget below your reply (product cards with Add buttons,
    comparison tables, cart summaries, etc.). Repeating them is noise.
  * Never produce pipe-delimited (| col | col |) tables. Never wrap a list
    of products, offers, cart items, or rules in a markdown list.
  * You MAY use a single short **bold** phrase to call out the key number
    (e.g. "Cheapest is **KES 899** at Carrefour."). Nothing more elaborate.
  * After tools run, your job is to tell the user what you did in one line
    and, if useful, what they can do next — not to reformat the data."""


def get_client() -> tuple[AsyncOpenAI | None, str]:
    """Return (client, model). Client is None if no API key is configured."""
    settings = get_settings()
    if not settings.llm_api_key:
        return None, settings.llm_model
    base_url = settings.llm_base_url or PROVIDER_BASE_URLS.get(
        settings.llm_provider, PROVIDER_BASE_URLS["groq"],
    )
    client = AsyncOpenAI(api_key=settings.llm_api_key, base_url=base_url)
    return client, settings.llm_model


def _sanitize_incoming(messages: list[dict]) -> list[dict]:
    """Drop any 'system' messages the client tried to inject — we own the system prompt."""
    return [m for m in messages if m.get("role") in {"user", "assistant", "tool"}]


async def run_chat(
    messages: list[dict],
    db: AsyncSession,
    user: User,
) -> dict:
    """
    Run a chat turn with tool-calling.

    Returns: {
      messages: [...],        # full transcript including tool turns
      invocations: [...],     # structured tool results for the UI
      reply: str,             # final assistant text
    }
    """
    client, model = get_client()
    if client is None:
        return {
            "messages": _sanitize_incoming(messages) + [
                {"role": "assistant",
                 "content": "AI assistant is not configured yet. Set LLM_API_KEY in the backend environment (Groq or OpenRouter key) and restart."}
            ],
            "invocations": [],
            "reply": "AI assistant is not configured yet.",
        }

    # Build the OpenAI-format conversation starting from our system prompt.
    convo: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    convo.extend(_sanitize_incoming(messages))

    settings = get_settings()
    invocations: list[dict] = []

    for _ in range(max(1, settings.llm_max_tool_rounds)):
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=convo,
                tools=TOOL_SCHEMAS,
                temperature=0.2,
            )
        except Exception as e:
            logger.error("LLM call failed", error=str(e))
            convo.append({
                "role": "assistant",
                "content": f"The AI provider returned an error: {e}",
            })
            break

        choice = response.choices[0]
        assistant_msg = choice.message

        # Append the assistant's turn (may contain tool_calls)
        turn: dict[str, Any] = {"role": "assistant"}
        if assistant_msg.content:
            turn["content"] = assistant_msg.content
        else:
            turn["content"] = ""
        if assistant_msg.tool_calls:
            turn["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in assistant_msg.tool_calls
            ]
        convo.append(turn)

        if not assistant_msg.tool_calls:
            break  # Model is done

        # Execute each tool call and append a tool-role response per call.
        for tc in assistant_msg.tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            result = await execute_tool(tc.function.name, args, db, user)
            invocations.append({
                "id": tc.id,
                "tool": tc.function.name,
                "arguments": args,
                "result": result,
            })
            convo.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "name": tc.function.name,
                "content": json.dumps(result)[:20000],  # guard against huge payloads
            })

    reply = next(
        (m.get("content", "") for m in reversed(convo)
         if m.get("role") == "assistant" and m.get("content")),
        "",
    )
    return {
        "messages": [m for m in convo if m.get("role") != "system"],
        "invocations": invocations,
        "reply": reply,
    }
