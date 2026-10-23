import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// El proyecto no incluye @types/node (el código es de navegador); basta con
// declarar `process` aquí para leer variables de entorno al construir.
declare const process: { env: Record<string, string | undefined> }

// Ruta base: '/' en local; '/VeloLayer/' en GitHub Pages (la define el
// workflow de Actions con la variable BASE_PATH).
const base = process.env.BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base,
  plugins: [
    react(),
    // El service worker no interviene en las pruebas; se omite en modo test.
    ...(mode === 'test'
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png'],
            manifest: {
              name: 'VeloLayer — ropa de ciclismo según el tiempo',
              short_name: 'VeloLayer',
              description:
                '¿Qué ropa de ciclismo me pongo? Recomendación según la previsión a lo largo de toda la ruta.',
              lang: 'es',
              start_url: base,
              scope: base,
              display: 'standalone',
              orientation: 'portrait',
              theme_color: '#16a34a',
              background_color: '#f3f6f4',
              categories: ['sports', 'travel', 'weather'],
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                {
                  src: 'icon-maskable-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
              navigateFallback: 'index.html',
              // Solo se cachea lo visitado: sin precarga masiva de teselas.
              runtimeCaching: [
                {
                  // Teselas de OpenStreetMap: caché limitada (política de uso de OSM).
                  urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'osm-tiles',
                    cacheableResponse: { statuses: [0, 200] },
                    expiration: { maxEntries: 300, maxAgeSeconds: 604800 },
                  },
                },
                {
                  // APIs de Open-Meteo: red con respaldo en caché.
                  urlPattern:
                    /^https:\/\/(api\.open-meteo\.com|geocoding-api\.open-meteo\.com)\/.*/,
                  handler: 'NetworkFirst',
                  options: {
                    cacheName: 'open-meteo-api',
                    networkTimeoutSeconds: 12,
                    cacheableResponse: { statuses: [0, 200] },
                    expiration: { maxEntries: 60, maxAgeSeconds: 21600 },
                  },
                },
              ],
            },
          }),
        ]),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
}))
