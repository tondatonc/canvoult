import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { isOfflineEnabled, setupOffline, teardownOffline } from './offlineDb.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

// Offline mode is opt-in (default off) so it doesn't use storage on every
// visitor's device — only set up the service worker if the user has
// explicitly turned it on via the toggle in the menu. If it's off, actively
// clean up any leftover registration/cache/IndexedDB from before it was
// turned off, rather than just leaving it running silently.
window.addEventListener('load', () => {
  if (isOfflineEnabled()) {
    setupOffline();
  } else {
    teardownOffline().catch(() => {});
  }
});
