/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' para que el build funcione en cualquier subcarpeta (GitHub Pages, Netlify, archivo estático)
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
});
