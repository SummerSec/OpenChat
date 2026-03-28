import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 4173
  },
  preview: {
    host: "0.0.0.0",
    port: 4173
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        settings: resolve(__dirname, "settings.html"),
        friends: resolve(__dirname, "friends.html"),
        auth: resolve(__dirname, "auth.html"),
        history: resolve(__dirname, "history.html")
      }
    }
  }
});
