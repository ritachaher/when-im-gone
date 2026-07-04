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
      // Register the SW from the app entry only (src/main.tsx). The default
      // auto-injection also put registration on the marketing landing page,
      // which made a scope-'/' SW answer *all* navigations with a cached
      // index.html - breaking /app, /privacy, /terms and /blog/* for every
      // returning visitor.
      injectRegister: false,
      workbox: {
        // The PWA shell fallback is the app, not the landing page…
        navigateFallback: '/app.html',
        // …and never intercept marketing/legal/blog routes at all; let the
        // server (staticwebapp.config.json rewrites) handle them.
        navigateFallbackDenylist: [
          /^\/$/,
          /^\/index\.html/,
          /^\/privacy/,
          /^\/terms/,
          /^\/about/,
          /^\/sample/,
          /^\/blog/,
        ],
        // Don't precache marketing + legal pages: stale pricing or stale
        // "Last updated" legal text must never be served from cache.
        globIgnores: [
          '**/node_modules/**',
          'index.html',
          'privacy.html',
          'terms.html',
          'about.html',
          'sample.html',
          'blog/**',
          'landing.js',
          'landing.css',
          'web-i18n.js',
          'picker.js',
          'page.css',
        ],
      },
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
