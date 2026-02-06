
import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminApp from './AdminApp';

// Register Service Worker with Global Scope
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[Admin] Sentinel Active:', reg.scope);
        // Request notification permission immediately if possible
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      })
      .catch(err => console.error('[Admin] Sentinel Failed:', err));
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <AdminApp />
    </React.StrictMode>
  );
}
