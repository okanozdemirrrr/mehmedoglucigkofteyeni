import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Capacitor iOS/Android: göreli asset yolları (beyaz ekran / chunk 404 önlemi)
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/jspdf') || id.includes('jspdf-autotable')) {
            return 'pdf'
          }
          if (id.includes('node_modules/html2canvas') || id.includes('node_modules/purify')) {
            return 'pdf-vendor'
          }
          if (id.includes('node_modules/@supabase')) {
            return 'supabase'
          }
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/react/') || id.includes('node_modules\\react\\')) {
            return 'react-vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
