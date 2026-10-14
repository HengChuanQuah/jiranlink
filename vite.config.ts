import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => ({
  // "pages" builds for GitHub Pages, served from https://<user>.github.io/jiranlink/
  base: mode === "pages" ? "/jiranlink/" : "/",
  plugins: mode === "single" ? [react(), viteSingleFile()] : [react()],
  build: { outDir: mode === "single" ? "dist-single" : mode === "pages" ? "dist-pages" : "dist" },
  test: { environment: "node" },
}));
