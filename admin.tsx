
import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminApp from './AdminApp';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <AdminApp />
    </React.StrictMode>
  );
}
