import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Garçom — Lanchonete',
        short_name: 'Garçom',
        theme_color: '#3b82f6',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    }),
  ],
  server: { port: 5176 },
})
