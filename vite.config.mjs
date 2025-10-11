import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: path.resolve("./node_modules/react")
    },
  },
  root: "./",
  base: "./",
  server: {
    port: 5173,
  },
});
