import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// 電子感謝狀 /thanks/<id>：只是一張狀，不掛整個網站（見 components/ThanksPublicPage.tsx）
const thanksId = /^\/thanks\/([0-9a-f-]{36})\/?$/i.exec(window.location.pathname)?.[1] ?? '';
const ThanksPublicPage = lazy(() => import('./components/ThanksPublicPage'));

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {thanksId
      ? <Suspense fallback={null}><ThanksPublicPage id={thanksId} /></Suspense>
      : <App />}
  </React.StrictMode>
);
