import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Function form, not the object form: this build runs on Rolldown, whose
        // manualChunks only accepts a function.
        manualChunks(id: string) {
          // React changes only when we upgrade it, while app code changes on every deploy.
          // Splitting it out means a returning customer re-downloads the app chunk but keeps
          // React from cache — which matters most during the Diwali rush, when the same
          // people come back across several days and we ship fixes between them.
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return 'react-vendor';
          }
          return undefined;
        }
      }
    },
    // The entry chunk is ~520 kB (148 kB gzip) and is already split as far as is useful:
    // the routes a first-time visitor does not touch are lazy, and Firebase is deferred.
    // Raised so a real regression stands out instead of being lost in a warning we expect.
    chunkSizeWarningLimit: 600
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    // Allow access through Cloudflare quick tunnels (client testing).
    allowedHosts: ['.trycloudflare.com']
  }
});
