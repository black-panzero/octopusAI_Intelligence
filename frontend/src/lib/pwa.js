// src/lib/pwa.js
// Register the service worker once on boot. Silent failure — PWA features
// are a progressive enhancement; the app keeps working without them.
export const registerServiceWorker = () => {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  // Only register on secure origins — SW is a no-op on http://
  const isSecure = window.isSecureContext || window.location.hostname === 'localhost';
  if (!isSecure) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // eslint-disable-next-line no-console
      console.info('[SmartBuy] Service worker registration skipped:', err?.message);
    });
  });
};
