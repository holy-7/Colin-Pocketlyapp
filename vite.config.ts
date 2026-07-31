/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Colin记账',
        short_name: 'Colin记账',
        description: '数据自控 + 极简无广告的个人记账',
        theme_color: '#FFD93D',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'logo-app.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'logo-app.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            // Supabase Data API — NetworkFirst (数据接口)
            urlPattern: /^https:\/\/hawungoiwtnbjmqqenpi\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60,
              },
            },
          },
          {
            // Supabase Auth API — NetworkOnly (认证接口不缓存)
            urlPattern: /^https:\/\/hawungoiwtnbjmqqenpi\.supabase\.co\/auth\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
});
