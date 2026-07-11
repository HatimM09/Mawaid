/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
  devOptions: {
    enabled: false
  },
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['al-mawaid.png', 'wheat_bg.png', 'icons.svg'],
      manifest: {
        name: 'Al-Mawaid | المَوَائِد',
        short_name: 'Al-Mawaid',
        description: ' Daily Tiffin Menu, Survey & Service Management System',
        theme_color: '#D4AF37',
        background_color: '#060d1a',
        display: 'standalone',
        id: '/',
        scope: '/',
        start_url: '/',
        categories: ['food', 'lifestyle'],
        icons: [
          {
            src: '/al-mawaid.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/al-mawaid.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/al-mawaid.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
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
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor';
          }
          if (id.includes('node_modules/firebase/')) {
            return 'firebase';
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/cloudfunctions': {
        target: 'https://us-central1-al-mawaid-8ffef.cloudfunctions.net',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/cloudfunctions/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
  },
})
