import { defineConfig } from "vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src")
    }
  },
  server: {
    host: "0.0.0.0",
    port: 9090,
    hmr: true,
    watch: {
      usePolling: true,
      interval: 1000
    },
    fs: {
      cachedChecks: false
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 9090,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        settings: resolve(__dirname, "settings.html"),
        friends: resolve(__dirname, "friends.html"),
        auth: resolve(__dirname, "auth.html"),
        history: resolve(__dirname, "history.html")
      },
      output: {
        manualChunks: {
          vendor: []
        }
      }
    },
    chunkSizeWarningLimit: 500,
    sourcemap: false,
    minify: "esbuild"
  }
});
