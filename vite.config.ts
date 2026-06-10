/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
    },
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectManifest: {
          injectionPoint: 'self.__WB_MANIFEST'
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'logos/sps-logo-icon.png'],
        manifest: {
          name: 'SPS Corner Kantin Digital',
          short_name: 'SPS Corner',
          description: 'Aplikasi Kiosk Kantin Digital SPS Corner',
          theme_color: '#059669',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          
          icons: [
            {
              src: '/logos/sps-logo-icon.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/logos/sps-logo-icon.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: '/logos/sps-logo-icon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            }
          ]
        }
      })
    ],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      'import.meta.env.VITE_VAPID_PUBLIC_KEY': JSON.stringify(env.VITE_VAPID_PUBLIC_KEY || ''),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/recharts')) return 'vendor-recharts';
            if (id.includes('node_modules/xlsx')) return 'vendor-xlsx';
            if (id.includes('node_modules/html2canvas')) return 'vendor-html2canvas';
            if (id.includes('node_modules/react-qr-code') || id.includes('node_modules/react-webcam') || id.includes('node_modules/@zxing')) return 'vendor-scanner';
            if (id.includes('node_modules/@tiptap') || id.includes('node_modules/prosemirror')) return 'vendor-editor';
            if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) return 'vendor-motion';
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) return 'vendor-charts';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
    },
  };
});
