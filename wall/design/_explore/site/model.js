/* The site's document for the study: pages of several kinds, each story with its own arrangement and its own items.
   Photographs live in one library: the twelve samples from ../ways/data.js plus whatever is added from the computer,
   kept in this browser (IndexedDB, as raw bytes, which Safari accepts). A page refers to a photograph; it does not own it. */
(function () {
  var S = window.SERIES, LIB = {}, esc = S.esc;
  S.works.forEach(function (w) { var f = /(\d+)\.jpg$/.exec(w.src)[1]; LIB[f] = Object.assign({ f: f, sample: true, file: f + ".jpg" }, w); });
  /* A space keeps one site apart from another: the study board plays in ?space=board and never touches the site built in the editor. */
  var SPACE = (/[?&]space=(\w+)/.exec(location.search) || [])[1] || "", KEY = "latent-site-study-v3" + (SPACE ? ":" + SPACE : ""), PUB = "latent-site-published-v1" + (SPACE ? ":" + SPACE : ""), DB = "latent-site-study";
  function story(id, title, titleEm, kicker, note, arrangement, items) { return { id: id, kind: "story", title: title, titleEm: titleEm, kicker: kicker, note: note, arrangement: arrangement, inNav: true, items: items }; }
  function im(f, arrange, note, full) { return { f: f, arrange: arrange || "alone", note: note || "", full: !!full }; }
  function example() {
    return {
      name: "Habib Saleh", title: "Ordinary", titleEm: "things", kicker: "Photographs · Lebanon · 2023 – 2025",
      note: "Five stories from villages in the Lebanese hills, made while they were still there.", contact: "Prints and enquiries · hello@example.com", front: "covers", plan: "full", template: "folio",
      pages: [
        story("road", "The road", "in", "Spring 2025", "The way up to the village, and what stands at its last turn.", "held", [im("12", "alone", "", true), im("8", "margin-note", "A pine above the last turn of the village road."), { pause: true, label: "From the story", text: "Most of what these photographs show is not rare. It is simply about to be gone." }, im("2")]),
        story("looked", "He looked", "back", "December 2023 – 2025", "One man, met twice, two years apart.", "book", [im("5", "alone", "", true), im("3", "with-next"), im("4")]),
        story("gate", "Through the", "gate", "November 2025", "Courtyards, gates and the things kept behind them.", "passage", [im("10"), im("7", "with-next"), im("11")]),
        story("afternoon", "Afternoon, the", "street", "Summer 2025", "Children, trees and the hour when nothing is asked of anyone.", "held", [im("1", "alone", "", true), im("6")]),
        story("light", "Late", "light", "Autumn 2025", "Walls and leaves in the last hour of sun.", "contact", [im("9"), im("6"), im("7")]),
        { id: "door", kind: "writing", title: "The door", titleEm: "remembers", kicker: "A poem · Beirut, 2026", image: "9", inNav: true, text: "The door remembers\nthe shape of every leaving:\na hand, a weight, the small\nhesitation before the latch.\n\nIt keeps no names.\nIt keeps the draught\nthat followed you out,\nand the light that did not." },
        { id: "about", kind: "about", title: "About", inNav: true, paras: ["Habib Saleh photographs and makes films. These stories were made over two years, on visits to villages in Lebanon, in the light of ordinary afternoons.", "The photographs are available as prints and as a short film."] },
        { id: "contact", kind: "contact", title: "Contact", inNav: true, paras: ["Prints, exhibitions and enquiries: hello@example.com.", "Studio visits by appointment, in Beirut."] }
      ]
    };
  }
  function fresh(name, title, titleEm) {
    return { name: name || "Your name", title: title || "Your", titleEm: titleEm || "work", kicker: "Photographs", note: "A line or two about what is here.", contact: "Prints and enquiries · you@example.com", front: "covers", plan: "free", template: "folio",
      pages: [{ id: "about", kind: "about", title: "About", inNav: true, paras: ["A few lines about you and the work."] }, { id: "contact", kind: "contact", title: "Contact", inNav: true, paras: ["How to reach you."] }] };
  }
  function load() {
    if (/[?&]reset/.test(location.search)) { try { localStorage.removeItem(KEY); } catch (e) {} }
    if (/[?&]published/.test(location.search)) { try { var p = localStorage.getItem(PUB); if (p) return JSON.parse(p).doc; } catch (e) {} }
    try { var s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {}
    return example();
  }
  function save(doc) { doc.rev = (doc.rev || 0) + 1; try { localStorage.setItem(KEY, JSON.stringify(doc)); return true; } catch (e) { return false; } }
  function stored() { try { var s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function publish(doc) { var rec = { doc: doc, at: new Date().toISOString() }; try { localStorage.setItem(PUB, JSON.stringify(rec)); } catch (e) {} return rec; }
  function published() { try { var p = localStorage.getItem(PUB); return p ? JSON.parse(p) : null; } catch (e) { return null; } }
  function count(p) { return p.items.filter(function (it) { return !it.pause; }).length; }
  function words(n) { return ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][n] || String(n); }
  function view(p) {
    if (p.kind !== "story") { var v = Object.assign({}, p); v.image = p.image && LIB[p.image] ? LIB[p.image] : null; return v; }
    var works = [], n = 0, items = p.items.map(function (it, k) {
      if (it.pause) return Object.assign({ k: k }, it);
      if (!LIB[it.f]) return null;
      var w = Object.assign({}, LIB[it.f], it); n++; w.n = ("0" + n).slice(-2); w.i = n - 1; w.k = k; works.push(w); return w;
    }).filter(Boolean);
    var groups = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.pause) groups.push({ type: "pause", k: it.k, label: it.label, text: it.text });
      else if (it.arrange === "with-next" && items[i + 1] && !items[i + 1].pause) { groups.push({ type: "pair", works: [it, items[i + 1]] }); i++; }
      else if (it.arrange === "margin-note") groups.push({ type: "note", works: [it], note: it.note });
      else groups.push({ type: "single", works: [it] });
    }
    var c = works.length;
    return Object.assign({}, p, { works: works, groups: groups, cover: works[0] || null, count: c, meta: (p.kicker ? p.kicker + " · " : "") + (words(c).charAt(0).toUpperCase() + words(c).slice(1)) + " photograph" + (c === 1 ? "" : "s") });
  }

  /* ---- photographs added from the computer ---- */
  /* If the browser's database does not answer (private windows, some test engines), carry on without it: photographs then last the session. */
  function db() { return new Promise(function (ok, no) { var done = false, t = setTimeout(function () { if (!done) { done = true; no(new Error("no database")); } }, 1500); try { var r = indexedDB.open(DB, 1); r.onupgradeneeded = function () { r.result.createObjectStore("images", { keyPath: "id" }); }; r.onsuccess = function () { if (done) return; done = true; clearTimeout(t); ok(r.result); }; r.onerror = function () { if (done) return; done = true; clearTimeout(t); no(r.error); }; } catch (err) { done = true; clearTimeout(t); no(err); } }); }
  function within(ms, p, fallback) { return Promise.race([p, new Promise(function (ok, no) { setTimeout(function () { fallback === undefined ? no(new Error("slow database")) : ok(fallback); }, ms); })]); }
  function all() { return within(2500, db().then(function (d) { return new Promise(function (ok) { var r = d.transaction("images").objectStore("images").getAll(); r.onsuccess = function () { ok(r.result || []); }; r.onerror = function () { ok([]); }; }); }), []).catch(function () { return []; }); }
  function put(rec) { return within(4000, db().then(function (d) { return new Promise(function (ok, no) { var t = d.transaction("images", "readwrite"); t.objectStore("images").put(rec); t.oncomplete = function () { ok(rec); }; t.onerror = function () { no(t.error); }; }); })); }
  function today() { var d = new Date(); return d.getDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()] + " " + d.getFullYear(); }
  function register(rec) { var url = URL.createObjectURL(new Blob([rec.bytes], { type: rec.type })); LIB[rec.id] = { f: rec.id, src: url, r: rec.w / rec.h, w: rec.w, h: rec.h, alt: rec.title, title: rec.title, date: rec.date, file: rec.id + (rec.type === "image/png" ? ".png" : ".jpg"), bytes: rec.bytes, type: rec.type }; return LIB[rec.id]; }
  function ready() { return all().then(function (recs) { recs.forEach(register); return LIB; }); }
  /* A file from the computer: sized down to 2400 px on the long edge, kept as JPEG bytes, named from the file. */
  function importFile(file) {
    if (file.size > 15 * 1024 * 1024) return Promise.reject(new Error(file.name + " is over 15 MB."));
    return new Promise(function (ok, no) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s), c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h); URL.revokeObjectURL(u);
        c.toBlob(function (b) { b.arrayBuffer().then(function (bytes) { var id = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "); var rec = { id: id, bytes: bytes, type: "image/jpeg", w: w, h: h, title: title.charAt(0).toUpperCase() + title.slice(1), date: today() }; put(rec).then(function () { ok(register(rec)); }, function () { var r = register(rec); r.unsaved = true; ok(r); }); }); }, "image/jpeg", .9);
      };
      img.onerror = function () { URL.revokeObjectURL(u); no(new Error(file.name + " could not be read.")); }; img.src = u;
    });
  }
  window.SiteModel = { LIB: LIB, load: load, save: save, stored: stored, KEY: KEY, example: example, fresh: fresh, publish: publish, published: published, view: view, count: count, esc: esc, ready: ready, importFile: importFile };
})();
