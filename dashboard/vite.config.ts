import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Allow overriding the base path for assets at build time.
  // Useful for GitHub Pages where the site is served from /<repo>/.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
});
