import { defineConfig } from "vite";

// Latent Wall's templates are plain pages under design/; Vite only serves them while we work.
// The service (sign-in, the site on the server, publish) runs beside it with `npm run api` and answers /api/*.
export default defineConfig({
  server: { host: "127.0.0.1", port: 5181, strictPort: true, proxy: { "/api": { target: "http://127.0.0.1:8787", changeOrigin: false } } },
});
