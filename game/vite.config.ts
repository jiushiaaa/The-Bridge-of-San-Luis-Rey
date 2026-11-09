import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  publicDir: 'public',
  server: { host: '127.0.0.1', port: 5186, strictPort: true },
  preview: { host: '127.0.0.1', port: 4186, strictPort: true },
  build: { outDir: '../dist', emptyOutDir: true, assetsDir: 'app', sourcemap: false },
});
