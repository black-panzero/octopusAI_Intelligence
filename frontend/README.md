# 1. Create the React app
npm create vite@latest frontend --template react
cd frontend

# 2. Install dependencies
npm install axios

# 3. Install Tailwind CSS
Downgrade to Compatible Version

npm uninstall tailwindcss @tailwindcss/postcss


npm install -D tailwindcss@^3.4.0 postcss@^8.4.0 autoprefixer@^10.4.0

# 4. Create tailwind.config.js and postcss.config.js
### tailwind.config.js
bash```
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### postcss.config.js
bash```
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

# 5. Start the development server
npm run dev