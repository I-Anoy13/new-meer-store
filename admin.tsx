
import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminApp from './AdminApp';

// Register Service Worker for Admin Persistence & Notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => console.log('Admin SW Registered:', reg.scope))
      .catch(err => console.log('Admin SW Failed:', err));
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
