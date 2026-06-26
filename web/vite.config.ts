import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 7001,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:7000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:7000',
        ws: true,
        changeOrigin: true,
      },
      '/avatars': {
        target: 'http://localhost:7000',
        changeOrigin: true,
      },
    },
  },
});
