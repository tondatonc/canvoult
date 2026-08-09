import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

// Register service worker for offline app shell + image caching.
// Wrapped defensively so any failure here can never break the app itself.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});

    // Whenever a NEW service worker version takes control of this page —
    // whether this is the very first install, or an update replacing an
    // earlier (possibly broken) version — do a single automatic reload so
    // this page's own JS/CSS requests get captured by the fetch handler
    // and cached for offline use. Guarded by sessionStorage so it can only
    // fire once per browser session (no reload loops).
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (sessionStorage.getItem('cv_sw_reloaded')) return;
      sessionStorage.setItem('cv_sw_reloaded', '1');
      window.location.reload();
    });
  });
}
