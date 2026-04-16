import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

// PWA service-worker generation breaks if the absolute build path contains an
// apostrophe (workbox emits un-escaped single-quoted strings). Disable the SW
// locally when that's the case; the CI build path is always safe.
const disablePwa = /['"]/.test(process.cwd());

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      disable: disablePwa,
      manifest: {
        name: "When I'm gone",
        short_name: "When I'm gone",
        description: 'A calm, private place to gather what your loved ones will need.',
        theme_color: '#f7f3ec',
        background_color: '#f7f3ec',
        display: 'standalone',
        start_url: '/app.html',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
      },
    },
  },
  server: { port: 5173 },
});
