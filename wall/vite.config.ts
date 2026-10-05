import { defineConfig } from "vite";

// Latent Wall's templates are plain pages under design/; Vite only serves them while we work.
export default defineConfig({
  server: { host: "127.0.0.1", port: 5181, strictPort: true },
});
