import { resolve } from "node:path";
import type {} from "vitest/config";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { build } from "esbuild";
export default defineConfig({
  // Evidence exports must carry the same real CSS as browser-built exports.
  test: { css: true },
  plugins: [
    react(),
    {
      name: "portable-artist-website",
      resolveId(id) {
        if (id === "virtual:export-runtime") return "\0export-runtime";
      },
      handleHotUpdate(context) {
        const module =
          context.server.moduleGraph.getModuleById("\0export-runtime");
        if (module && context.file.includes("/src/")) {
          context.server.moduleGraph.invalidateModule(module);
          return [...context.modules, module];
        }
      },
      async load(id) {
        if (id !== "\0export-runtime") return;
        const result = await build({
          entryPoints: ["src/export-entry.tsx"],
          bundle: true,
          write: false,
          minify: true,
          metafile: true,
          format: "iife",
          platform: "browser",
          jsx: "automatic",
          define: { "process.env.NODE_ENV": '"production"' },
        });
        for (const file of Object.keys(result.metafile!.inputs))
          if (file.startsWith("src/")) this.addWatchFile(resolve(file));
        return `export default ${JSON.stringify(result.outputFiles[0].text)}`;
      },
    },
  ],
});
