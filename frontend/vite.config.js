import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Requests to /api go to the Express server, so the frontend never hardcodes a backend URL
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:5000' },
  },
});
