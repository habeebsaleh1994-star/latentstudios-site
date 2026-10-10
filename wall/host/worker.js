/* Latent Wall hosting, in miniature: one Worker serves every published site from one R2 bucket.
   A site's files live under a folder named after it (`<name>/index.html`, `<name>/the-road-in/index.html`, `<name>/assets/…`);
   the folder is read from the first label of the host (`name.latentstudios.art`) or, on the bare host, from the first
   path segment (`/name/…`). Folders are clean URLs: `/the-road-in/` serves `the-road-in/index.html`. Missing files get the
   site's own 404 page when it has one. Headers match what the published files expect: long cache for assets, none for pages. */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    const labels = url.hostname.split(".");
    const bare = env.BARE_HOSTS ? env.BARE_HOSTS.split(",").includes(url.hostname) : labels.length <= 2;
    let name, path;
    if (bare) { const [, first, ...rest] = url.pathname.split("/"); name = first; path = rest.join("/"); if (!name) return new Response("Latent Wall", { status: 200 }); }
    else { name = labels[0]; path = url.pathname.replace(/^\//, ""); }
    name = name.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!name) return new Response("Not found", { status: 404 });
    if (path === "" || path.endsWith("/")) path += "index.html";
    let obj = await env.SITES.get(`${name}/${path}`);
    if (!obj && !path.includes(".")) { // a page named without its slash
      return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301);
    }
    if (!obj) { obj = await env.SITES.get(`${name}/404.html`); if (!obj) return new Response("Not found", { status: 404 }); return body(obj, path, 404); }
    return body(obj, path, 200);
  },
};
const TYPES = { html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", json: "application/json", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", svg: "image/svg+xml", mp4: "video/mp4", woff2: "font/woff2", txt: "text/plain; charset=utf-8", xml: "application/xml" };
function body(obj, path, status) {
  const ext = path.split(".").pop().toLowerCase(), type = TYPES[ext] || obj.httpMetadata?.contentType || "application/octet-stream";
  const h = new Headers({ "content-type": type, etag: obj.httpEtag, "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" });
  h.set("cache-control", path.startsWith("assets/img/") || path.startsWith("assets/fonts/") ? "public, max-age=31536000, immutable" : ext === "html" ? "no-cache" : "public, max-age=0, must-revalidate");
  if (ext === "html") h.set("x-frame-options", "SAMEORIGIN");
  return new Response(obj.body, { status, headers: h });
}
