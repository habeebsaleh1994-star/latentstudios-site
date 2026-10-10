import { defineConfig } from "vite";

// Latent Wall's templates are plain pages under design/; Vite only serves them while we work.
// The service (sign-in, the site on the server, publish) runs beside it with `npm run api` and answers /api/*.
export default defineConfig({
  server: { host: "127.0.0.1", port: 5181, strictPort: true, proxy: { "/api": { target: "http://127.0.0.1:8787", changeOrigin: false,
    // without `npm run api` the service is simply absent, as on a computer of one's own: "who is signed in" answers that
    // plainly (no one; no service), and anything else is refused, so the app works on this device alone without noise
    configure: (proxy) => proxy.on("error", (_e, req, res) => {
      const out = res as import("node:http").ServerResponse; if (out.headersSent) return;
      const me = (req.url ?? "").split("?")[0] === "/api/me" && req.method === "GET";
      out.writeHead(me ? 200 : 503, { "content-type": "application/json" }).end(JSON.stringify(me ? { signedIn: false, reachable: false } : { offline: true }));
    }) } } },
});
