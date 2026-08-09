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
    navigator.serviceWorker.register('/sw.js').then(() => {
      // The page that triggers SW installation is NOT controlled by it yet
      // (that only starts on the *next* navigation), so its own JS/CSS
      // requests slip through uncached — leaving offline mode with an
      // empty shell (blank white screen) until the user manually reopens
      // the app a second time. To avoid needing that, do a single
      // automatic reload once the new SW actually takes control, so this
      // load's assets get captured by the fetch handler and cached.
      if (!navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (sessionStorage.getItem('cv_sw_reloaded')) return;
          sessionStorage.setItem('cv_sw_reloaded', '1');
          window.location.reload();
        });
      }
    }).catch(() => {});
  });
}
