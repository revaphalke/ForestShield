import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 8081,
    strictPort: true,
    proxy: { "/c-api": { target: "http://127.0.0.1:8090", changeOrigin: true, rewrite: (path) => path.replace(/^\/c-api/, "") } },
  },
  preview: { host: "127.0.0.1", port: 8081, strictPort: true },
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), nitro({ preset: "vercel" }), viteReact()],
});
