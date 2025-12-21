import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Configure asset handling for src/assets/wraps
  publicDir: false, // We're not using public dir for these assets
  assetsInclude: ['**/*.gltf', '**/*.bin'], // Include GLTF and binary files as assets
  resolve: {
    alias: {
      '@assets': resolve(__dirname, './src/assets'),
    },
  },
  // Serve assets from src/assets in development
  server: {
    fs: {
      allow: ['..'],
    },
  },
})
