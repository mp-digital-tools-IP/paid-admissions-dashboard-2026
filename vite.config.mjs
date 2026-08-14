import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
  },
  server: {
    host: "0.0.0.0",
  },
  plugins: [react()],
});
