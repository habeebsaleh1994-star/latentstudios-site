/*
 * The shared engine. A template (room.js) says how its page looks and how its pieces can sit;
 * everything else lives here: loading and saving the document, history, adding and replacing
 * images, the customise panel, plan limits, the edit bar.
 *
 * A template is an object:
 *   name, accepts(doc)       the template's own name (its document is stored under it) and which stored documents it can open
 *   page, seed, assets       which page of the document, where the seed document and its asset sizes are
 *   sections, words          which customise sections and which words the panel edits
 *   toContent(doc, resolve)  document -> { site, ...model }       (the model is whatever the template edits)
 *   fromContent(doc, c)      { site, ...model } -> document
 *   render(ctx)              -> html for the whole page
 *   count(M)                 how many photographs the model holds
 *   arrange: { options(M, bi, id), apply(M, key, bi, id) }       how a work can sit
 *   onWord(k, v, ctx)        optional: update the page when a word changes
 * and may override: addWorks, removeWork, move, replaceWork, setText.
 */
(function () {
  var L = window.LatentStudio, T = window.FolioTheme, E = window.LatentEntitlements;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fetchJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }); }
  var PREVIEW = /[?&]preview/.test(location.search);

  /* ---------- helpers for templates built from single / pair / split blocks ---------- */
  var blocks = {
    portrait: function (M, id) { return M.works[id].h > M.works[id].w; },
    find: function (M, id) { for (var i = 0; i < M.blocks.length; i++) { var b = M.blocks[i]; if (b.work === id || (b.works && b.works.indexOf(id) > -1)) return i; } return -1; },
    remove: function (M, id) {
      var bi = blocks.find(M, id); if (bi < 0) return; var b = M.blocks[bi];
      if (b.type === "pair") M.blocks[bi] = { type: "single", work: b.works[0] === id ? b.works[1] : b.works[0] }; else M.blocks.splice(bi, 1);
      delete M.works[id];
    },
    move: function (M, bi, dir) { var j = bi + dir; if (j < 0 || j >= M.blocks.length) return false; var x = M.blocks[bi]; M.blocks[bi] = M.blocks[j]; M.blocks[j] = x; return true; },
    add: function (M, after, ims, today) {
      var at = after + 1, first = null;
      ims.forEach(function (im, k) {
        var id = "n" + Date.now().toString(36) + k;
        M.works[id] = { assetId: im.assetId, src: im.src, w: im.w, h: im.h, title: "Untitled", date: today, alt: "Untitled" }; if (!first) first = id;
        M.blocks.splice(at + k, 0, { type: "single", work: id });
      });
      return first;
    },
    replace: function (M, id, im) { var w = M.works[id]; w.assetId = im.assetId; w.src = im.src; w.w = im.w; w.h = im.h; },
    setText: function (M, d, v, before) {
      if (d.w) { var w = M.works[d.w]; if (d.f === "title" && (!w.alt || w.alt === before)) w.alt = v; w[d.f] = v; } else M.blocks[+d.b][d.f] = v;
    },
    /* the standard way a work can sit */
    arrange: {
      options: function (M, bi, id) {
        var b = M.blocks[bi], prev = M.blocks[bi - 1], next = M.blocks[bi + 1], o = [];
        function plain(x) { return x && x.type === "single" && !blocks.portrait(M, x.work); }
        if (b.type === "pair") return [{ key: "separate", d: "single", t: "Each on its own", s: "Two large photographs, one after the other" }];
        var port = blocks.portrait(M, id);
        if (b.type === "split") return [{ key: "single", d: "single", t: "Large and alone", s: "Without the margin note" }, { key: "split", d: "split", t: "Portrait with a note", s: "Margin note beside the photograph", cur: true }];
        o.push({ key: "single", d: "single", t: "Large and alone", s: "Held still, with a caption", cur: true });
        if (port) o.push({ key: "split", d: "split", t: "Portrait with a note", s: "Margin note beside the photograph" });
        if (!port && plain(prev)) o.push({ key: "pair-prev", d: "pair-prev", t: "Pair with the one before", s: "Side by side" });
        if (!port && plain(next)) o.push({ key: "pair-next", d: "pair", t: "Pair with the next one", s: "Side by side" });
        return o;
      },
      apply: function (M, key, bi, id) {
        var b = M.blocks[bi];
        if (key === "separate") M.blocks.splice(bi, 1, { type: "single", work: b.works[0] }, { type: "single", work: b.works[1] });
        else if (key === "single") M.blocks[bi] = { type: "single", work: id };
        else if (key === "split") M.blocks[bi] = { type: "split", work: id, note: "A note on this photograph." };
        else if (key === "pair-prev") M.blocks.splice(bi - 1, 2, { type: "pair", works: [M.blocks[bi - 1].work, id] });
        else if (key === "pair-next") M.blocks.splice(bi, 2, { type: "pair", works: [id, M.blocks[bi + 1].work] });
      }
    }
  };

  function run(room) {
    var doc, rev, persist = true, S, M, state, accentsFromWork = [], panelApi, assetsStatic;
    var past = [], future = [], editing = false, arranging = null, toastTimer, savedText = "Saved on this device", saveTimer, saving = false, dirty = false, stale = false;
    var el = {};

    /* ---------- chrome: the dock, the file input and the panel are the engine's, not the template's ---------- */
    function ensureChrome() {
      if (PREVIEW) return;
      var d = document.createElement("div");
      d.innerHTML = '<div class="dock" id="dock"><div class="meter" id="meter" hidden></div><button type="button" id="undo" hidden>Undo</button><button type="button" id="redo" hidden>Redo</button><button type="button" id="edit" aria-pressed="false">Edit</button><button class="tweak-btn" id="tweak" aria-expanded="false" aria-controls="panel">Customise</button></div><input type="file" id="file" accept="image/*" hidden><aside id="panel" aria-label="Customise your site"></aside>';
      while (d.firstChild) document.body.appendChild(d.firstChild);
    }

    /* ---------- saving ---------- */
    function themeFromState() { var o = {}; ["look", "palette", "mode", "accent", "type", "mount", "space", "motion", "read"].forEach(function (k) { o[k] = state[k]; }); o.options = state.options || {}; return o; }
    function setSaved(t) { savedText = t; var n = document.getElementById("saved"); if (n) n.textContent = t; }
    function commit() { if (!persist || stale) return; dirty = true; setSaved("Saving…"); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 350); }
    function flush() {
      if (saving) { saveTimer = setTimeout(flush, 200); return; }
      saving = true; dirty = false; var next, content = Object.assign({ site: S }, M);
      try { next = room.fromContent(doc, content); next = Object.assign({}, next, { theme: L.studioSchema.shape.theme.parse(themeFromState()) }); }
      catch (e) { saving = false; setSaved("Not saved"); toast("Could not save: " + e.message); return; }
      L.store.save(next, rev, room.name).then(function (r) { doc = next; rev = r; saving = false; setSaved(dirty ? "Saving…" : "Saved on this device"); if (dirty) flush(); })
        .catch(function (e) { saving = false; if (e && e.name === "StaleRevisionError") { stale = true; setSaved("Not saved"); toast(e.message); } else { setSaved("Not saved"); toast("Could not save in this browser."); } });
    }

    /* ---------- images ---------- */
    function decode(blob) { return new Promise(function (res, rej) { var u = URL.createObjectURL(blob), im = new Image(); im.onload = function () { res({ src: u, w: im.naturalWidth, h: im.naturalHeight }); }; im.onerror = rej; im.src = u; }); }
    function downscale(file) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || typeof createImageBitmap !== "function") return Promise.resolve(file);
      return createImageBitmap(file, { imageOrientation: "from-image" }).then(function (bm) {
        var k = Math.min(1, 2400 / Math.max(bm.width, bm.height)), c = document.createElement("canvas"); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
        c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
        return new Promise(function (res) { c.toBlob(function (b) { res(b && b.size < file.size ? b : file); }, "image/jpeg", 0.86); });
      }).catch(function () { return file; });
    }
    function ingest(file) {
      return downscale(file).then(function (blob) {
        return (persist ? L.store.putImage(blob) : Promise.resolve("asset:" + Math.random().toString(36).slice(2))).then(function (assetId) {
          return decode(blob).then(function (d) { return { assetId: assetId, src: d.src, w: d.w, h: d.h }; });
        });
      });
    }
    function ingestVideo(file) {
      return (persist ? L.store.putVideo(file) : Promise.resolve("asset:" + Math.random().toString(36).slice(2))).then(function (assetId) { return { assetId: assetId, src: URL.createObjectURL(file) }; });
    }
    var PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="3" height="2"><rect width="3" height="2" fill="#bbb"/></svg>');
    function resolveAll() {
      var ids = [], seen = {}; doc.pages.forEach(function (p) { p.blocks.forEach(function (b) { if (b.assetId && !seen[b.assetId]) { seen[b.assetId] = 1; ids.push(b.assetId); } }); });
      var out = {};
      return Promise.all(ids.map(function (id) {
        if (L.isStoredAsset(id)) return L.store.readImage(id).then(function (blob) { return blob ? (/^video\//.test(blob.type) ? { src: URL.createObjectURL(blob), w: 16, h: 9 } : decode(blob)) : null; }).then(function (d) { out[id] = d || { src: PLACEHOLDER, w: 3, h: 2 }; });
        var a = assetsStatic[id]; out[id] = a ? { src: id, w: a.w, h: a.h } : { src: PLACEHOLDER, w: 3, h: 2 };
      })).then(function () { return out; });
    }

    /* ---------- history ---------- */
    function snap() { past.push(JSON.stringify(M)); if (past.length > 80) past.shift(); future = []; commit(); }
    function undo() { if (!past.length) return; future.push(JSON.stringify(M)); M = JSON.parse(past.pop()); arranging = null; commit(); draw(); }
    function redo() { if (!future.length) return; past.push(JSON.stringify(M)); M = JSON.parse(future.pop()); arranging = null; commit(); draw(); }
    function count() { return room.count(M); }
    function toast(msg) { var t = document.getElementById("toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "tbnote"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 4200); }

    /* ---------- the pieces templates draw with ---------- */
    function diagram(kind) { return kind === "pair" ? '<span class="dg dg-pair"><i class="me"></i><i></i></span>' : kind === "pair-prev" ? '<span class="dg dg-pair"><i></i><i class="me"></i></span>' : kind === "split" ? '<span class="dg dg-split"><i></i><i class="me"></i><i></i></span>' : kind === "wall" ? '<span class="dg dg-wall"><i></i><i class="me"></i><i></i></span>' : '<span class="dg dg-single"><i class="me"></i></span>'; }
    var ui = {
      esc: esc,
      toolbar: function (bi, id) {
        var last = (M.blocks ? M.blocks.length : 1) - 1;
        return '<div class="tb' + (arranging && arranging.id === id ? " open" : "") + '" role="toolbar" aria-label="Edit this photograph">' +
          '<button type="button" data-act="replace" data-w="' + id + '">Replace</button>' +
          (room.arrange ? '<button type="button" data-act="arrange" data-bi="' + bi + '" data-w="' + id + '" aria-expanded="' + !!(arranging && arranging.id === id) + '">Arrange</button>' : "") +
          '<button type="button" data-act="up" data-bi="' + bi + '"' + (bi === 0 ? " disabled" : "") + ' aria-label="Move earlier">&uarr;</button>' +
          '<button type="button" data-act="down" data-bi="' + bi + '"' + (bi === last ? " disabled" : "") + ' aria-label="Move later">&darr;</button>' +
          '<button type="button" data-act="remove" data-w="' + id + '">Remove</button></div>';
      },
      arrangePanel: function (bi, id) {
        var h = '<div class="arr" role="dialog" aria-label="How should this sit?"><h4>How should this sit?</h4>';
        room.arrange.options(M, bi, id).forEach(function (o) { h += '<button type="button" data-act="apply" data-key="' + o.key + '" data-bi="' + bi + '" data-w="' + id + '"' + (o.cur ? ' aria-current="true"' : "") + ">" + diagram(o.d) + "<span>" + o.t + "<small>" + (o.cur ? "Current" : o.s) + "</small></span></button>"; });
        return h + "</div>";
      },
      /* an editable word attached to a work (title, date) */
      cap: function (id, f) { return '<span contenteditable="plaintext-only" spellcheck="false" data-w="' + id + '" data-f="' + f + '">' + esc(M.works[id][f]) + "</span>"; },
      /* editable text attached to a block */
      text: function (bi, f, value, tag, cls) { tag = tag || "span"; return "<" + tag + (cls ? ' class="' + cls + '"' : "") + ' contenteditable="plaintext-only" data-b="' + bi + '" data-f="' + f + '">' + esc(value) + "</" + tag + ">"; },
      arrangeOpen: function (id) { return !!(arranging && arranging.id === id); },
      addRow: function (i, end) { var full = count() >= E.limit("photographs"); return '<div class="addrow' + (end ? " end" : "") + '"><button type="button" data-act="add" data-after="' + i + '" aria-label="Add photographs ' + (end ? "at the end" : "here") + '"' + (full ? ' disabled title="Your plan\'s photograph limit has been reached"' : "") + ">" + (end ? "Add photographs" : "+") + "</button></div>"; },
    };

    /* ---------- drawing ---------- */
    function ctx() { return { S: S, M: M, editing: editing, arranging: arranging, ui: ui, word: function (k) { return S[k]; }, esc: esc }; }
    function renderPage() {
      el.app.innerHTML = room.render(ctx());
      if (room.afterRender) room.afterRender(ctx());
      observe(); chrome();
    }
    function draw() { var y = scrollY; renderPage(); scrollTo(0, y); }
    function chrome() {
      if (editing) document.documentElement.dataset.editing = "on"; else document.documentElement.removeAttribute("data-editing");
      if (PREVIEW) return;
      var u = document.getElementById("undo"), r = document.getElementById("redo"), ed = document.getElementById("edit"), m = document.getElementById("meter");
      u.hidden = r.hidden = !editing; u.disabled = !past.length; r.disabled = !future.length;
      ed.textContent = editing ? "Done" : "Edit"; ed.setAttribute("aria-pressed", editing);
      var lim = E.limit("photographs"); m.hidden = !editing; m.className = "meter" + (count() >= lim ? " full" : "");
      m.innerHTML = "<b>" + count() + "</b> / " + lim + ' <span class="more">photographs · ' + E.name() + ' · <span class="saved" id="saved">' + esc(savedText) + "</span></span>";
    }
    var io;
    function observe() {
      var els = document.querySelectorAll(".arrive");
      if (editing || !("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
      if (io) io.disconnect();
      io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
      els.forEach(function (e) { io.observe(e); });
    }

    /* ---------- editing ---------- */
    function today() { var d = new Date(); return d.getDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()] + " " + d.getFullYear(); }
    var pending = null;
    function bindEditing() {
      var fileInput = document.getElementById("file");
      fileInput.addEventListener("change", function () {
        var files = [].slice.call(fileInput.files), job = pending; fileInput.value = ""; pending = null; if (!files.length || !job) return;
        if (job.kind === "custom" && job.meta.video) {
          if (!E.limit("video")) return toast("Films can be added on the " + E.PLANS.full.name + " plan. You can still link to a film hosted elsewhere.");
          ingestVideo(files[0]).then(function (v) { snap(); room.onVideo(M, job.meta, v); draw(); }).catch(function (e) { toast(e && e.message ? e.message : "That film could not be read."); });
          return;
        }
        if (job.kind === "custom") {
          var left = E.limit("photographs") - count();
          if (!job.meta.replace && left <= 0) return toast("You have reached the " + E.limit("photographs") + " photograph limit on the " + E.name() + " plan.");
          var use = job.meta.replace ? files.slice(0, 1) : files.slice(0, Math.max(1, left));
          Promise.all(use.map(ingest)).then(function (ims) { snap(); room.onImages(M, job.meta, ims, today()); draw(); }).catch(function (e) { toast(e && e.message ? e.message : "That file could not be read as an image."); });
          return;
        }
        if (job.kind === "replace") {
          ingest(files[0]).then(function (im) { snap(); (room.replaceWork || blocks.replace)(M, job.id, im); draw(); }).catch(function (e) { toast(e && e.message ? e.message : "That file could not be read as an image."); });
          return;
        }
        var roomLeft = E.limit("photographs") - count();
        if (roomLeft <= 0) return toast("You have reached the " + E.limit("photographs") + " photograph limit on the " + E.name() + " plan.");
        var take = files.slice(0, roomLeft);
        Promise.all(take.map(ingest)).then(function (ims) {
          snap(); var firstId = (room.addWorks || blocks.add)(M, job.after, ims, today());
          if (files.length > take.length) toast("Added " + take.length + ". The rest would pass your plan's " + E.limit("photographs") + " photograph limit.");
          arranging = room.arrange ? { id: firstId } : null; draw();
          var n = document.querySelector('[data-w="' + firstId + '"]'); n && n.scrollIntoView({ block: "center" });
        }).catch(function (e) { toast(e && e.message ? e.message : "One of those files could not be read as an image."); });
      });
      document.addEventListener("click", function (e) {
        var t = e.target.closest("[data-act]");
        if (!t) { if (arranging && !e.target.closest(".arr")) { arranging = null; draw(); } return; }
        var a = t.dataset.act, bi = +t.dataset.bi, id = t.dataset.w;
        if (a === "replace") { pending = { kind: "replace", id: id }; fileInput.multiple = false; fileInput.accept = "image/*"; fileInput.click(); }
        else if (a === "add") { pending = { kind: "add", after: +t.dataset.after }; fileInput.multiple = true; fileInput.accept = "image/*"; fileInput.click(); }
        else if (a === "arrange") { arranging = arranging && arranging.id === id ? null : { id: id }; draw(); }
        else if (a === "up" || a === "down") { snap(); var moved = (room.move || blocks.move)(M, bi, a === "up" ? -1 : 1); if (!moved) { past.pop(); return; } arranging = null; draw(); }
        else if (a === "remove") { snap(); (room.removeWork || blocks.remove)(M, id); arranging = null; draw(); toast("Removed. Undo brings it back."); }
        else if (a === "apply") { if (t.getAttribute("aria-current") === "true") return; snap(); room.arrange.apply(M, t.dataset.key, bi, id); arranging = null; draw(); }
        else if (room.act) room.act(a, t, { M: M, S: S, snap: snap, draw: draw, toast: toast, pick: function (meta, multiple) { pending = { kind: "custom", meta: meta }; fileInput.multiple = !!multiple; fileInput.accept = meta.video ? "video/mp4,video/webm" : "image/*"; fileInput.click(); } });
      });
      var before = "";
      document.addEventListener("focusin", function (e) { if (e.target.isContentEditable) before = e.target.textContent; });
      document.addEventListener("focusout", function (e) {
        var n = e.target; if (!n.isContentEditable || n.textContent === before) return;
        var v = n.dataset.multiline !== undefined ? n.textContent.replace(/\r/g, "").replace(/\s+$/g, "") : n.textContent.replace(/\s+/g, " ").trim();
        snap(); (room.setText || blocks.setText)(M, n.dataset, v, before, S); if (room.afterText) room.afterText(M, n.dataset, { draw: draw }); chrome();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && e.target.isContentEditable && e.target.dataset.multiline === undefined) { e.preventDefault(); e.target.blur(); }
        if (e.key === "Escape" && arranging) { arranging = null; draw(); }
        if (editing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.target.isContentEditable) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      });
      document.getElementById("undo").addEventListener("click", undo);
      document.getElementById("redo").addEventListener("click", redo);
      document.getElementById("edit").addEventListener("click", function () { editing = !editing; arranging = null; draw(); if (editing) toast("Click a photograph to edit it. Click words to rewrite them."); });
      addEventListener("beforeunload", function () { if (dirty || saving) flush(); });
    }

    /* ---------- boot ---------- */
    /* When the look changes, keep what the reader is looking at where it is, even if the content above it grows or shrinks. */
    function holdPlace(change) {
      var cands = [[.55, .35], [.55, .45], [.55, .55], [.55, .25], [.3, .35], [.3, .5]], pt = null, top = 0;
      for (var i = 0; i < cands.length && !pt; i++) {
        var e = document.elementFromPoint(innerWidth * cands[i][0], innerHeight * cands[i][1]);
        if (e && e !== document.documentElement && e !== document.body && e.id !== "app" && e.tagName !== "MAIN") pt = e;
      }
      if (pt) top = pt.getBoundingClientRect().top;
      change();
      function back() {
        if (!pt || !document.body.contains(pt)) return;
        var d = pt.getBoundingClientRect().top - top;
        if (Math.abs(d) < 1) return;
        var html = document.documentElement, was = html.style.scrollBehavior; html.style.scrollBehavior = "auto"; window.scrollBy(0, d); html.style.scrollBehavior = was;
      }
      back();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(back, 60); });
    }
    function refresh(kind) { if (kind === "full") { T.apply(state); commit(); draw(); return; } holdPlace(function () { T.apply(state); commit(); chrome(); }); }
    function start(content) {
      S = content.site; M = Object.assign({}, content); delete M.site;
      state = Object.assign({}, T.DEFAULTS, doc.theme, { words: {} });
      var lm = /[?&]look=([a-z]+)/.exec(location.search); if (lm && T.LOOKS[lm[1]]) state.look = lm[1];
      var am = /[?&]accent=([0-9a-fA-F]{6})/.exec(location.search); if (am) state.accent = "#" + am[1];
      var om = /[?&]opt=([^&]+)/.exec(location.search), given = Object.assign({}, state.options);
      if (om) decodeURIComponent(om[1]).split(",").forEach(function (kv) { var a = kv.split(":"); if (a[0] && a[1]) given[a[0]] = a[1]; });
      if (!T.lookAllowed(state.look, room.name)) state.look = "quiet";
      state.options = T.cleanOptions(room.options, given);
      if (!PREVIEW) {
        panelApi = window.LatentPanel.mount({
          state: state, panel: document.getElementById("panel"), btn: document.getElementById("tweak"),
          sections: room.sections, words: room.words, template: room.name, options: room.options, getWord: function (k) { return S[k]; }, accentsFromWork: function () { return accentsFromWork; }, refresh: refresh,
          onWord: function (k, v) { S[k] = v; commit(); room.onWord && room.onWord(k, v, ctx()); }
        });
        if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { if (state.mode === "system") refresh("theme"); });
        bindEditing();
      }
      T.apply(state); renderPage();
      if (!PREVIEW) {
        if (location.search.indexOf("panel") > -1) panelApi.toggle(true);
        if (location.search.indexOf("edit") > -1) { editing = true; draw(); }
        var srcs = []; (function walk(o) { if (o && typeof o === "object") { if (o.src && o.assetId !== undefined) srcs.push(o.src); Object.keys(o).forEach(function (k) { walk(o[k]); }); } })(M);
        T.accentsFromImages(srcs).then(function (a) { accentsFromWork = a; panelApi.render(); }).catch(function () {});
      }
    }
    el.app = document.getElementById("app");
    ensureChrome();
    Promise.all([fetchJSON(room.seed), fetchJSON(room.assets)]).then(function (r) {
      var seed = r[0]; assetsStatic = r[1];
      var wantReset = location.search.indexOf("reset") > -1;
      if (PREVIEW) { persist = false; return { doc: L.studioSchema.parse(seed), revision: 0 }; }
      return (wantReset ? L.store.reset(seed, room.name) : L.store.load(seed, room.name, room.accepts)).then(function (x) { if (!wantReset) L.store.prune().catch(function () {}); return x; })
        .catch(function () { persist = false; return { doc: L.studioSchema.parse(seed), revision: 0 }; });
    }).then(function (r) {
      doc = r.doc; rev = r.revision;
      return resolveAll().then(function (res) { start(room.toContent(doc, function (id) { return res[id]; })); if (!persist && !PREVIEW) toast("Changes will not be saved in this browser."); });
    }).catch(function (e) { el.app.innerHTML = '<p style="padding:40px;font-family:sans-serif">Could not open this site: ' + esc(e.message) + "</p>"; });
  }

  window.LatentEngine = { run: run, blocks: blocks, esc: esc };
})();
