import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      // The service worker is authored as plain JavaScript (`src/sw.js`) because
      // the precache list is only knowable after Vite has hashed the asset
      // names. `injectManifest` replaces `self.__WB_MANIFEST` with that real
      // list, and the worker is written to behave correctly before the swap.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2}'],
        // Only the app shell is cached: this app stores everything in IndexedDB
        // and has no private API responses that could leak into a shared cache.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: "Anusree's Daily Tracker",
        short_name: 'Daily Tracker',
        description:
          'A cute, local-first student planner: timetable, study timer, projects, habits, sleep tracker and analytics.',
        theme_color: '#F2A7C3',
        background_color: '#FFFAFC',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: './',
        start_url: './',
        categories: ['productivity', 'education', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('dexie')) return 'storage'
          if (id.includes('motion')) return 'motion'
          if (id.includes('date-fns')) return 'dates'
          return 'vendor'
        },
      },
    },
  },
})
