import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 3001, open: true },
  build: { outDir: "dist", chunkSizeWarningLimit: 1200 },
});
