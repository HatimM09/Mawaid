import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Al-Mawaid',
        short_name: 'Mawaid',
        description: 'Al-Mawaid Food Survey System',
        theme_color: '#060d1a',
        background_color: '#060d1a',
        display: 'standalone',
        icons: [
          {
            src: '/al-mawaid.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/al-mawaid.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        }
      }
    }
  },
  server: {
    port: 5173,
  }
})
