import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  esbuild: {
    // Disable linting completely
    legalComments: 'none',
    // Log level to hide warnings
    logLevel: 'error',
    // Disable parsing JSX with TypeScript
    jsx: 'transform',
  },
  css: {
    // Disable CSS validation
    devSourcemap: false,
    // Configure CSS modules
    modules: {
      localsConvention: 'camelCase',
    },
    // Configure CSS preprocessors
    preprocessorOptions: {
      scss: {
        additionalData: '',
      },
      less: {
        javascriptEnabled: true,
      },
    },
  },
  build: {
    // Disable source maps
    sourcemap: false,
    // Disable warnings for bundle size
    chunkSizeWarningLimit: 10000,
    // Show errors only, not warnings
    reportCompressedSize: false,
  },
  server: {
    host: true, // Listen on all addresses
    port: 5173, // Default port
    strictPort: false, // Allow fallback ports
    open: true, // Auto-open browser
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending request to:', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log(`Response from ${req.url} with status: ${proxyRes.statusCode}`);
          });
        },
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
