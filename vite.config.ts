import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    visualizer({
      filename: './dist/bundle-analysis.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules/react')) return 'vendor-react'
          if (id.includes('node_modules/@tanstack/react-query')) return 'vendor-query'
          if (id.includes('node_modules/recharts')) return 'vendor-charts'
          if (id.includes('node_modules/@supabase/supabase-js')) return 'vendor-supabase'
          if (id.includes('node_modules/@sentry/react')) return 'vendor-sentry'
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
