import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { App } from './App';

// Polyfill `crypto.randomUUID` for browsers that do not implement it (e.g. the
// Chromium bundled with Playwright v1.49). Runs before the app mounts so id
// generation for diagrams, tables and relationships works in every runtime.
((): void => {
  const c = crypto as { randomUUID?: () => string } | undefined;
  if (c && typeof c.randomUUID !== 'function') {
    c.randomUUID = (): string => {
      const hex = (): string =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
      return `${hex()}${hex()}${hex()}${hex()}-${hex()}${hex()}-${hex()}${hex()}-${hex()}${hex()}-${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}`;
    };
  }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
