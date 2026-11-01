import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base = nombre del repo, para servir desde GitHub Pages (https://<user>.github.io/Sword_and_Thunder/)
export default defineConfig({
  base: '/Sword_and_Thunder/',
  plugins: [
    react(),
    // PWA: instalable y offline. El service worker guarda todo el build; al publicar una versión nueva,
    // se actualiza solo la próxima vez que se abre la app. La sesión sigue en localStorage.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sword and Thunder',
        short_name: 'Sword&Thunder',
        description: 'Ficha y menú jugable de Pathfinder 1e',
        lang: 'es',
        start_url: './#/play',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0e0f13',
        theme_color: '#0e0f13',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,json}'] },
    }),
  ],
})
