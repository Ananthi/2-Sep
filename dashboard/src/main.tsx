import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const el = document.getElementById('root');
// Initialize theme from localStorage or system preference
try {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else if (saved === 'dark') document.documentElement.removeAttribute('data-theme');
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
} catch {}
if (!el) {
  console.error('Root element #root not found');
} else {
  console.log('Booting dashboard app…');
  const root = createRoot(el);
  root.render(<App />);
  setTimeout(() => {
    const len = (document.getElementById('root')?.innerHTML || '').length;
    console.log('After render, #root innerHTML length =', len);
  }, 0);
}
