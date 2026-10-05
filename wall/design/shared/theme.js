/* Folio theme: a small set of designed choices. Every combination is built to look right together. */
(function () {
  var PALETTES = {
    silk:  { name: "Silk",  light: { silk: "#EEE9E7", deep: "#E4DDDA", ink: "#29222A", soft: "#6B5F66", rule: "#D3C9C7" }, dark: { silk: "#1B1619", deep: "#241E21", ink: "#ECE4E4", soft: "#A99BA1", rule: "#372F33" } },
    bone:  { name: "Bone",  light: { silk: "#EDE8DD", deep: "#E1DACA", ink: "#2B2620", soft: "#6E6558", rule: "#D0C7B5" }, dark: { silk: "#1B1814", deep: "#25211B", ink: "#EAE4D8", soft: "#A59C8C", rule: "#38322A" } },
    fog:   { name: "Fog",   light: { silk: "#E8ECEA", deep: "#DAE0DD", ink: "#1F2725", soft: "#5B6764", rule: "#C8D0CC" }, dark: { silk: "#151A19", deep: "#1D2423", ink: "#E3E9E6", soft: "#97A5A1", rule: "#2B3432" } },
    clay:  { name: "Clay",  light: { silk: "#F0E6E1", deep: "#E6D7D0", ink: "#34222A", soft: "#7A5F66", rule: "#D9C4BF" }, dark: { silk: "#201719", deep: "#2A1F22", ink: "#F0E4E2", soft: "#B49CA0", rule: "#40302F" } },
    night: { name: "Night", light: { silk: "#E7E6E7", deep: "#DAD8DA", ink: "#18161A", soft: "#615D64", rule: "#C9C6CA" }, dark: { silk: "#121114", deep: "#1A191D", ink: "#E8E6EA", soft: "#9A96A0", rule: "#2A282D" } }
  };
  var ACCENTS = ["#B87B8A", "#8A7280", "#7C8B7F", "#A5895A", "#5F7389", "#A4574E"];
  var TYPES = {
    silk:    { name: "Silk",    display: '"Newsreader", "Iowan Old Style", Georgia, serif',          body: '"Newsreader", "Iowan Old Style", Georgia, serif',     label: '"Instrument Sans", system-ui, sans-serif', weight: 300 },
    press:   { name: "Press",   display: '"Libre Caslon Text", Georgia, serif',                      body: '"Libre Caslon Text", Georgia, serif',                 label: '"Karla", system-ui, sans-serif',            weight: 400 },
    atelier: { name: "Atelier", display: '"Instrument Serif", Georgia, serif',                       body: '"Instrument Sans", system-ui, sans-serif',            label: '"Instrument Sans", system-ui, sans-serif', weight: 400 },
    archive: { name: "Archive", display: '"Newsreader", "Iowan Old Style", Georgia, serif',          body: '"Newsreader", "Iowan Old Style", Georgia, serif',     label: '"IBM Plex Mono", ui-monospace, monospace', weight: 300 }
  };

  /* A look is a whole art direction: type, colour, headline style, line weight, shape, image treatment, structure.
     Layout is the template's; the look is what gives a site its personality. "quiet" is Latent's own and leaves the palette/type pickers in charge. */
  var LOOK_KEYS = ["--silk", "--silk-deep", "--ink", "--ink-soft", "--peony", "--rule", "--serif", "--body", "--sans", "--title-weight", "--body-size", "--h1-size", "--h1-lh", "--h1-track", "--h1-case", "--em-style", "--em-color", "--em-bg", "--label-case", "--label-track", "--label-size", "--label-weight", "--rule-w", "--radius", "--frame", "--frame-shadow", "--page", "--sp", "--peony-text", "--on-accent"];
  var LOOKS = {
    quiet: { name: "Quiet", note: "Latent's own. Soft, literary, unhurried." },
    swiss: { name: "Swiss", note: "Grid, grotesque, one red.", scheme: "light", fill: "silk", vars: { "--silk": "#F3F3F1", "--silk-deep": "#E6E6E2", "--ink": "#0E0E0E", "--ink-soft": "#55554F", "--peony": "#D1001F", "--rule": "#0E0E0E", "--serif": '"Archivo", system-ui, sans-serif', "--body": '"Archivo", system-ui, sans-serif', "--sans": '"Archivo", system-ui, sans-serif', "--title-weight": "700", "--body-size": "17px", "--h1-size": "clamp(54px, 10vw, 168px)", "--h1-lh": ".88", "--h1-track": "-.045em", "--em-style": "normal", "--em-color": "var(--peony)", "--label-track": ".06em", "--label-size": "11.5px", "--label-weight": "600", "--rule-w": "2px", "--sp": "0.85" } },
    darkroom: { name: "Darkroom", note: "Black, amber, monospace, grain.", scheme: "dark", vars: { "--silk": "#0B0B0C", "--silk-deep": "#151517", "--ink": "#D9D3C7", "--ink-soft": "#8C867B", "--peony": "#E8A857", "--rule": "#2A2A2C", "--serif": '"IBM Plex Mono", ui-monospace, monospace', "--body": '"Newsreader", Georgia, serif', "--sans": '"IBM Plex Mono", ui-monospace, monospace', "--title-weight": "400", "--h1-size": "clamp(30px, 4.6vw, 70px)", "--h1-lh": "1.12", "--h1-track": ".01em", "--h1-case": "uppercase", "--em-style": "normal", "--em-color": "var(--peony)", "--label-track": ".12em", "--label-size": "11px", "--frame": "1px solid #3a3226", "--sp": "1.1" } },
    zine: { name: "Zine", note: "Cheap paper, heavy type, marker.", scheme: "light", fill: "ink", vars: { "--silk": "#F1E7CF", "--silk-deep": "#E6D8B6", "--ink": "#1A1A1A", "--ink-soft": "#4A4437", "--peony": "#EF431D", "--rule": "#1A1A1A", "--serif": '"Fraunces", Georgia, serif', "--body": '"Fraunces", Georgia, serif', "--sans": '"Courier Prime", "Courier New", monospace', "--title-weight": "800", "--h1-size": "clamp(58px, 12vw, 200px)", "--h1-lh": ".84", "--h1-track": "-.035em", "--em-style": "italic", "--em-color": "var(--ink)", "--em-bg": "linear-gradient(transparent 52%, var(--peony) 52% 90%, transparent 90%)", "--label-case": "uppercase", "--label-track": ".04em", "--label-size": "13px", "--label-weight": "700", "--rule-w": "3px", "--frame": "3px solid #1A1A1A", "--frame-shadow": "12px 12px 0 var(--peony)", "--sp": "0.9" } },
    gallery: { name: "Gallery", note: "White wall, tiny type, great space.", scheme: "light", vars: { "--silk": "#FFFFFF", "--silk-deep": "#F3F3F3", "--ink": "#1C1C1C", "--ink-soft": "#666666", "--peony": "#666666", "--rule": "#E8E8E8", "--serif": '"Jost", system-ui, sans-serif', "--body": '"Jost", system-ui, sans-serif', "--sans": '"Jost", system-ui, sans-serif', "--title-weight": "400", "--body-size": "16px", "--h1-size": "clamp(20px, 2.1vw, 30px)", "--h1-lh": "1.5", "--h1-track": ".34em", "--h1-case": "uppercase", "--em-style": "normal", "--em-color": "var(--peony-text)", "--label-track": ".24em", "--label-size": "10px", "--sp": "1.55" } },
    toned: { name: "Toned paper", note: "Tan paper, brown ink, a hairline mount.", scheme: "light", vars: { "--silk": "#D8C6A4", "--silk-deep": "#CBB78F", "--ink": "#2C2116", "--ink-soft": "#58462F", "--peony": "#7B3A20", "--rule": "#B39C74", "--serif": '"Newsreader", "Iowan Old Style", Georgia, serif', "--body": '"Newsreader", Georgia, serif', "--sans": '"Newsreader", Georgia, serif', "--title-weight": "400", "--body-size": "18px", "--h1-size": "clamp(40px, 6.6vw, 96px)", "--h1-lh": "1.02", "--h1-track": "-.015em", "--em-style": "italic", "--em-color": "var(--peony-text)", "--label-case": "none", "--label-track": ".02em", "--label-size": "14px", "--frame": "1px solid rgba(44,33,22,.55)", "--sp": "1.05" } },
    cyanotype: { name: "Cyanotype", note: "Prussian blue ink on cream, a sun-print calm.", scheme: "light", vars: { "--silk": "#EFEBDF", "--silk-deep": "#E3DECF", "--ink": "#12335A", "--ink-soft": "#3F5C7B", "--peony": "#2A6A9E", "--rule": "#BFC6CC", "--serif": '"Newsreader", Georgia, serif', "--body": '"Newsreader", Georgia, serif', "--sans": '"IBM Plex Mono", ui-monospace, monospace', "--title-weight": "300", "--h1-size": "clamp(40px, 6.4vw, 94px)", "--h1-lh": "1.04", "--h1-track": "-.015em", "--em-style": "italic", "--em-color": "var(--peony-text)", "--label-track": ".12em", "--label-size": "11px", "--frame": "1px solid rgba(18,51,90,.5)", "--sp": "1.1" } },
    graphite: { name: "Graphite", note: "Cool pencil grey, light italic type, hairlines.", scheme: "light", vars: { "--silk": "#E4E3E0", "--silk-deep": "#D7D6D2", "--ink": "#2A2A2B", "--ink-soft": "#555558", "--peony": "#505053", "--rule": "#C2C1BD", "--serif": '"Newsreader", Georgia, serif', "--body": '"Newsreader", Georgia, serif', "--sans": '"Instrument Sans", system-ui, sans-serif', "--title-weight": "300", "--h1-size": "clamp(40px, 6.4vw, 94px)", "--h1-lh": "1.04", "--h1-track": "-.012em", "--em-style": "italic", "--em-color": "var(--peony-text)", "--label-track": ".16em", "--label-size": "10.5px", "--sp": "1.15" } },
    etching: { name: "Etching", note: "Laid paper, a plate mark round each picture, Caslon.", scheme: "light", vars: { "--silk": "#EEE5CE", "--silk-deep": "#E2D7BB", "--ink": "#1F1A12", "--ink-soft": "#564D3C", "--peony": "#6A2C20", "--rule": "#C3B692", "--serif": '"Libre Caslon Text", Georgia, serif', "--body": '"Libre Caslon Text", Georgia, serif', "--sans": '"Libre Caslon Text", Georgia, serif', "--title-weight": "400", "--body-size": "17px", "--h1-size": "clamp(36px, 5.8vw, 84px)", "--h1-lh": "1.06", "--h1-track": "-.01em", "--em-style": "italic", "--em-color": "var(--peony-text)", "--label-track": ".16em", "--label-size": "10.5px", "--frame": "1px solid rgba(31,26,18,.5)", "--sp": "1.05" } },
    monotype: { name: "Monotype", note: "Charcoal ground, smoky light, quiet italics.", scheme: "dark", vars: { "--silk": "#151413", "--silk-deep": "#1F1D1B", "--ink": "#E6E0D5", "--ink-soft": "#A39D92", "--peony": "#C8A57F", "--rule": "#33302C", "--serif": '"Newsreader", Georgia, serif', "--body": '"Newsreader", Georgia, serif', "--sans": '"Instrument Sans", system-ui, sans-serif', "--title-weight": "300", "--h1-size": "clamp(40px, 6.6vw, 96px)", "--h1-lh": "1.02", "--h1-track": "-.015em", "--em-style": "italic", "--em-color": "var(--peony-text)", "--label-track": ".16em", "--label-size": "10.5px", "--frame-shadow": "0 30px 70px -24px rgba(0,0,0,.8)", "--sp": "1.15" } },
    albumen: { name: "Albumen", only: ["lantern"], note: "An early print on a cream mount, the name beneath.", scheme: "light", vars: { "--silk": "#C9B791", "--silk-deep": "#B9A67C", "--ink": "#291E12", "--ink-soft": "#3E3120", "--peony": "#6B2F1E", "--rule": "#A8946B", "--serif": '"Libre Caslon Text", Georgia, serif', "--body": '"Libre Caslon Text", Georgia, serif', "--sans": '"Libre Caslon Text", Georgia, serif', "--title-weight": "400", "--body-size": "17px", "--h1-size": "clamp(36px, 5.8vw, 84px)", "--h1-lh": "1.06", "--h1-track": "-.01em", "--em-style": "italic", "--em-color": "var(--peony-text)", "--label-track": ".16em", "--label-size": "10.5px", "--sp": "1.05" } },
    proof: { name: "Proof sheet", only: ["folio"], note: "A contact print: film edges and frame numbers.", scheme: "dark", vars: { "--silk": "#14110F", "--silk-deep": "#1E1A17", "--ink": "#EDE3D3", "--ink-soft": "#B0A590", "--peony": "#F28C28", "--rule": "#3A332C", "--serif": '"Archivo", system-ui, sans-serif', "--body": '"Newsreader", Georgia, serif', "--sans": '"IBM Plex Mono", ui-monospace, monospace', "--title-weight": "700", "--h1-size": "clamp(34px, 5.4vw, 84px)", "--h1-lh": "1", "--h1-track": ".01em", "--h1-case": "uppercase", "--em-style": "normal", "--em-color": "var(--peony)", "--label-track": ".14em", "--label-size": "11.5px", "--sp": "1" } },
    paperback: { name: "Paperback", only: ["index"], note: "A page on a desk: cream paper, a book face, ornaments.", scheme: "light", vars: { "--silk": "#D5CCBC", "--silk-deep": "#EFE8D8", "--page": "#F6F0E2", "--ink": "#1E1A14", "--ink-soft": "#554C3E", "--peony": "#8C3B2A", "--rule": "#B9AE98", "--serif": '"Libre Caslon Text", Georgia, serif', "--body": '"Libre Caslon Text", Georgia, serif', "--sans": '"Libre Caslon Text", Georgia, serif', "--title-weight": "400", "--body-size": "18px", "--h1-size": "clamp(40px, 6.6vw, 98px)", "--h1-lh": "1.04", "--h1-track": "-.015em", "--em-style": "italic", "--em-color": "var(--peony)", "--label-case": "uppercase", "--label-track": ".16em", "--label-size": "11px", "--sp": "1" } },
    plaster: { name: "Plaster", only: ["salon"], note: "A plastered wall, black frames, brass plates.", scheme: "light", vars: { "--silk": "#EAE4D8", "--silk-deep": "#D9D1C0", "--ink": "#1B1813", "--ink-soft": "#4F473A", "--peony": "#6F5320", "--rule": "#B8AD96", "--serif": '"Libre Caslon Text", Georgia, serif', "--body": '"Libre Caslon Text", Georgia, serif', "--sans": '"IBM Plex Mono", ui-monospace, monospace', "--title-weight": "400", "--body-size": "17px", "--h1-size": "clamp(34px, 5.4vw, 80px)", "--h1-lh": "1.06", "--h1-track": "-.01em", "--em-style": "italic", "--em-color": "var(--peony)", "--label-track": ".12em", "--label-size": "11px", "--frame": "2px solid #111", "--sp": "1.1" } },
    cinema: { name: "Cinema", only: ["reel"], note: "The house lights down: black, red, a vignette.", scheme: "dark", vars: { "--silk": "#060505", "--silk-deep": "#141112", "--ink": "#EDE6DC", "--ink-soft": "#B0A79C", "--peony": "#E0525B", "--rule": "#2E2829", "--serif": '"Bodoni Moda", "Didot", Georgia, serif', "--body": '"Newsreader", Georgia, serif', "--sans": '"Instrument Sans", system-ui, sans-serif', "--title-weight": "400", "--h1-size": "clamp(46px, 8.4vw, 132px)", "--h1-lh": ".98", "--h1-track": "-.02em", "--em-style": "italic", "--em-color": "var(--peony)", "--label-track": ".2em", "--label-size": "11px", "--sp": "1.05" } },
    blueprint: { name: "Blueprint", only: ["atelier"], note: "White lines on blue, over a drawing grid.", scheme: "dark", vars: { "--silk": "#0F3558", "--silk-deep": "#164A78", "--ink": "#E8F4FF", "--ink-soft": "#AECDEA", "--peony": "#86D4FF", "--rule": "#3F7BB0", "--serif": '"IBM Plex Mono", ui-monospace, monospace', "--body": '"Instrument Sans", system-ui, sans-serif', "--sans": '"IBM Plex Mono", ui-monospace, monospace', "--title-weight": "400", "--h1-size": "clamp(30px, 4.8vw, 74px)", "--h1-lh": "1.08", "--h1-track": ".01em", "--h1-case": "uppercase", "--em-style": "normal", "--em-color": "var(--peony)", "--label-track": ".1em", "--label-size": "11px", "--rule-w": "1px", "--sp": "1" } },
    soft: { name: "Soft", note: "Friendly, rounded, warm.", scheme: "light", fill: "silk", vars: { "--silk": "#F8EDE6", "--silk-deep": "#F0DDD2", "--ink": "#3B2B2B", "--ink-soft": "#6F5A53", "--peony": "#A3422F", "--rule": "#EBD3C7", "--serif": '"Young Serif", Georgia, serif', "--body": '"DM Sans", system-ui, sans-serif', "--sans": '"DM Sans", system-ui, sans-serif', "--title-weight": "400", "--body-size": "18px", "--h1-size": "clamp(46px, 8vw, 118px)", "--h1-lh": "1.02", "--h1-track": "-.012em", "--em-style": "normal", "--em-color": "var(--peony)", "--label-case": "none", "--label-track": ".03em", "--label-size": "13px", "--label-weight": "500", "--radius": "22px", "--sp": "1" } }
  };

  /* The accent. The artist's choice wins in every look; if the look needs text on an accent fill, or the accent must read on the ground,
     it is moved toward black or white by the smallest amount that makes that true. */
  function fitFill(acc, ground, fillText) {
    function ok(c) { return contrast(c, ground) >= 3.1 && contrast(fillText, c) >= 4.5; }
    if (ok(acc)) return acc;
    for (var t = .002; t <= 1.001; t += .002) { var d = mix(acc, "#000000", t), l = mix(acc, "#ffffff", t); if (ok(d) && ok(l)) return contrast(d, acc) < contrast(l, acc) ? d : l; if (ok(d)) return d; if (ok(l)) return l; }
    return acc;
  }
  function accentFor(lookId, chosen, dark, palette) {
    var look = LOOKS[lookId] && lookId !== "quiet" ? LOOKS[lookId] : null, p = PALETTES[palette] || PALETTES.silk, c = dark ? p.dark : p.light;
    var ground = look ? look.vars["--silk"] : c.silk, ink = look ? look.vars["--ink"] : c.ink, base = look ? look.vars["--peony"] : "#B87B8A";
    var acc = chosen && /^#[0-9a-fA-F]{6}$/.test(chosen) ? chosen : base;
    var fillText = look && look.fill ? (look.fill === "ink" ? ink : ground) : null;
    var peony = fillText ? fitFill(acc, ground, fillText) : fit(acc, ground, ink, 3.1);
    return { peony: peony, text: fit(peony, ground, ink, 4.6), on: fillText || (contrast(ink, peony) >= contrast(ground, peony) ? ink : ground), ground: ground };
  }

  /* which looks a template offers: the shared ones, plus any made only for it */
  function looksFor(template) { return Object.keys(LOOKS).filter(function (k) { return !LOOKS[k].only || LOOKS[k].only.indexOf(template) > -1; }); }
  function lookAllowed(look, template) { return looksFor(template).indexOf(look) > -1; }
  /* keep only the options a template really declares, with values it really offers; anything else falls back to the default */
  function cleanOptions(declared, given) {
    var out = {}; (declared || []).forEach(function (o) { var v = given && given[o.key]; out[o.key] = o.choices.some(function (c) { return c[0] === v; }) ? v : o.def; }); return out;
  }
  var SPACE = { airy: 1.3, standard: 1, close: 0.7 };
  var READ = { small: 0.92, standard: 1, large: 1.12 };
  var DEFAULTS = { look: "quiet", options: {}, palette: "silk", mode: "system", accent: null, type: "silk", mount: "bare", space: "standard", motion: "slow", read: "standard", words: {} };

  /* colour maths */
  function hex2rgb(h) { h = h.replace("#", ""); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function rgb2hex(r) { return "#" + r.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"); }).join(""); }
  function lum(h) { var c = hex2rgb(h).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
  function mix(a, b, t) { var p = hex2rgb(a), q = hex2rgb(b); return rgb2hex(p.map(function (v, i) { return v + (q[i] - v) * t; })); }
  /* move an accent toward ink until it reads on the ground (3:1 is enough for large display type) */
  function fit(accent, ground, ink, need) { need = need || 3.1; var c = accent, t = 0; while (contrast(c, ground) < need && t < 1) { t += .05; c = mix(accent, ink, t); } return c; }

  function isDark(state) { return state.mode === "dark" || (state.mode === "system" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches); }

  function apply(state) {
    var look = LOOKS[state.look] && state.look !== "quiet" ? LOOKS[state.look] : null;
    var p = PALETTES[state.palette] || PALETTES.silk, dark = look ? look.scheme === "dark" : isDark(state), c = dark ? p.dark : p.light, t = TYPES[state.type] || TYPES.silk, r = document.documentElement.style;
    LOOK_KEYS.forEach(function (k) { r.removeProperty(k); });
    r.setProperty("--silk", c.silk); r.setProperty("--silk-deep", c.deep); r.setProperty("--ink", c.ink); r.setProperty("--ink-soft", c.soft); r.setProperty("--rule", c.rule);
    r.setProperty("--serif", t.display); r.setProperty("--body", t.body); r.setProperty("--sans", t.label); r.setProperty("--title-weight", t.weight);
    r.setProperty("--sp", SPACE[state.space] || 1); r.setProperty("--read", READ[state.read] || 1);
    if (look) Object.keys(look.vars).forEach(function (k) { r.setProperty(k, k === "--sp" ? String(look.vars[k] * (SPACE[state.space] || 1)) : look.vars[k]); });
    var A = accentFor(look ? state.look : "quiet", state.accent, dark, state.palette);
    r.setProperty("--peony", A.peony); r.setProperty("--peony-text", A.text); r.setProperty("--on-accent", A.on);
    var ed = dark ? { "--ed-bg": "#1E1A1C", "--ed-bg2": "#2A2528", "--ed-ink": "#EFE8E8", "--ed-soft": "#B2A5AB", "--ed-rule": "#4A4144", "--ed-accent": "#E0A3B2" } : { "--ed-bg": "#FBFAF9", "--ed-bg2": "#F0EDEB", "--ed-ink": "#29222A", "--ed-soft": "#655B61", "--ed-rule": "#D9D2D0", "--ed-accent": "#9A5A6D" };
    Object.keys(ed).forEach(function (k) { r.setProperty(k, ed[k]); });
    r.colorScheme = dark ? "dark" : "light";
    var d = document.documentElement.dataset;
    Object.keys(d).forEach(function (k) { if (/^opt[A-Z]/.test(k)) delete d[k]; });
    Object.keys(state.options || {}).forEach(function (k) { d["opt" + k.charAt(0).toUpperCase() + k.slice(1)] = state.options[k]; }); d.look = look ? state.look : "quiet"; d.mount = state.mount; d.motion = state.motion; d.type = state.type; d.read = state.read;
  }

  /* pull three harmonious accents out of the artist's own photographs */
  function accentsFromImages(srcs) {
    return Promise.all(srcs.map(function (src) {
      return new Promise(function (res) {
        var im = new Image(); im.onload = function () {
          try {
            var cv = document.createElement("canvas"), n = 24; cv.width = n; cv.height = n;
            var cx = cv.getContext("2d"); cx.drawImage(im, 0, 0, n, n);
            res(cx.getImageData(0, 0, n, n).data);
          } catch (e) { res(null); }
        }; im.onerror = function () { res(null); }; im.src = src;
      });
    })).then(function (all) {
      var buckets = []; for (var i = 0; i < 12; i++) buckets.push({ w: 0, r: 0, g: 0, b: 0 });
      all.forEach(function (d) {
        if (!d) return;
        for (var i = 0; i < d.length; i += 4) {
          var r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
          if (s < .22 || l < .2 || l > .8) continue;
          var h = mx === r ? ((g - b) / (mx - mn) + 6) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4, k = Math.floor(h * 2) % 12, w = s * (1 - Math.abs(l - .5) * 1.2);
          var bk = buckets[k]; bk.w += w; bk.r += d[i] * w; bk.g += d[i + 1] * w; bk.b += d[i + 2] * w;
        }
      });
      return buckets.filter(function (b) { return b.w > 0; }).sort(function (a, b) { return b.w - a.w; }).slice(0, 3).map(function (b) {
        var base = [b.r / b.w, b.g / b.w, b.b / b.w], grey = lum(rgb2hex(base)) * 255;
        return rgb2hex(base.map(function (v) { return v + (grey - v) * .28; })); /* soften toward grey so it sits in the house */
      });
    });
  }

  window.FolioTheme = { PALETTES: PALETTES, ACCENTS: ACCENTS, TYPES: TYPES, SPACE: SPACE, READ: READ, LOOKS: LOOKS, looksFor: looksFor, lookAllowed: lookAllowed, cleanOptions: cleanOptions, accentFor: accentFor, DEFAULTS: DEFAULTS, apply: apply, fit: fit, contrast: contrast, accentsFromImages: accentsFromImages };
})();
