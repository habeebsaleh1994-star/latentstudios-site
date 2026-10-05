/* Salon: many works hung together on a wall, at their real size relative to one another.
   Only what is specific to Salon is here; the engine does the rest. */
(function () {
  var L = window.LatentStudio, EN = window.LatentEngine;
  var PAGE = "works", WALL_CM = 400, GAP_CM = 14, DEFAULT_LONG = 60;

  /* walls: a run of works that "hang with" the next share a wall; a wall never runs wider than WALL_CM */
  function walls(M) {
    var out = [], cur = [], w = 0;
    M.blocks.forEach(function (b, i) {
      var cw = M.works[b.work].cmW, add = cur.length ? GAP_CM : 0;
      if (cur.length && w + add + cw > WALL_CM) { out.push(cur); cur = []; w = 0; add = 0; }
      cur.push({ b: b, i: i }); w += add + cw;
      if (b.hang === "alone") { out.push(cur); cur = []; w = 0; }
    });
    if (cur.length) out.push(cur);
    return out;
  }
  function wallCm(M, wall) { return wall.reduce(function (n, x, k) { return n + M.works[x.b.work].cmW + (k ? GAP_CM : 0); }, 0); }
  var current = null;
  function fit() {
    var s = document.querySelector(".salon"); if (!s || !current) return;
    var widest = Math.max.apply(null, [WALL_CM].concat(walls(current).map(function (w) { return wallCm(current, w); })));
    var biggest = Math.max.apply(null, Object.keys(current.works).map(function (k) { return current.works[k].cmW; }).concat([1]));
    s.style.setProperty("--k", (s.clientWidth / (widest + 72)).toFixed(4));
    s.style.setProperty("--maxcm", biggest);
  }
  addEventListener("resize", fit);

  function num(n) { return String(Math.round(n * 10) / 10).replace(/\.0$/, ""); }

  function render(c) {
    var S = c.S, M = c.M, esc = c.esc, ui = c.ui, editing = c.editing; current = M;
    var n = 0, hang = "";
    walls(M).forEach(function (wall) {
      var figs = "", key = "";
      wall.forEach(function (x) {
        var id = x.b.work, w = M.works[id]; n++;
        figs += '<figure class="art" style="--cw:' + w.cmW + '" data-view="' + x.i + '"><div class="frame"><img src="' + w.src + '" width="' + w.w + '" height="' + w.h + '" alt="' + esc(w.alt) + '" loading="lazy">' +
          (editing ? ui.toolbar(x.i, id) + (ui.arrangeOpen(id) ? ui.arrangePanel(x.i, id) : "") : "") + '</div><span class="no">' + n + '</span><span class="cap">' + esc(w.title) + ", " + num(w.cmW) + " × " + num(w.cmH) + " cm</span></figure>";
        key += '<li><span class="k">' + n + "</span><span>" + (editing
          ? ui.cap(id, "title") + ", " + ui.cap(id, "medium") + ', <span class="sz">' + ui.cap(id, "cmW") + " × " + ui.cap(id, "cmH") + " cm</span>, " + ui.cap(id, "date")
          : "<b>" + esc(w.title) + "</b>, " + esc(w.medium) + ', <span class="sz">' + num(w.cmW) + " × " + num(w.cmH) + " cm</span>, " + esc(w.date)) + "</span></li>";
      });
      hang += '<section class="hang arrive"><div class="wall">' + figs + '</div><ol class="key">' + key + "</ol>" + (editing ? ui.addRow(wall[wall.length - 1].i, false) : "") + "</section>";
    });
    if (editing && !M.blocks.length) hang += ui.addRow(-1, true);
    return '<header class="bar"><a class="name" href="#top">' + esc(S.name) + '</a><nav aria-label="Primary"><a href="#work">Work</a><a href="#about">About</a><a href="#contact">Contact</a></nav></header>' +
      '<main id="top"><section class="card" aria-labelledby="title"><div><div class="label">' + esc(S.kicker) + '</div><h1 id="title">' + esc(S.title) + " <em>" + esc(S.titleEm) + '</em></h1></div><p class="note">' + esc(S.note) + "</p></section>" +
      '<div class="salon" id="work">' + hang + "</div></main>" +
      '<section class="about" id="about"><div class="about-in"><h2>' + esc(S.aboutTitle) + "</h2><div>" + S.about.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + '</div></div><div class="foot" id="contact"><span class="label">' + esc(S.contact) + '</span><a class="mark" href="#top" aria-label="Made with Latent Wall">l.</a></div></section>';
  }

  /* click a work to see it large */
  document.addEventListener("click", function (e) {
    if (document.documentElement.dataset.editing) return;
    var f = e.target.closest(".art"); if (!f || !f.closest(".salon") || !current) return;
    var items = current.blocks.map(function (b) { var w = current.works[b.work]; return { src: w.src, alt: w.alt, title: w.title, meta: [w.medium, num(w.cmW) + " × " + num(w.cmH) + " cm", w.date].filter(Boolean).join(" · ") }; });
    window.LatentViewer.open(items, +f.dataset.view);
  });

  EN.run({
    name: "salon",
    accepts: function (d) { return d.pages.some(function (p) { return p.id === PAGE; }); },
    page: PAGE,
    options: [
      { key: "wall", title: "Wall", def: "tone", choices: [["tone", "Tinted"], ["white", "White"], ["dark", "Dark"]] },
      { key: "key", title: "Key", def: "under", choices: [["under", "Under the wall"], ["hidden", "Hidden"]] }
    ],
    seed: "doc/sora-vale.studio.json",
    assets: "doc/assets.json",
    sections: ["look", "options", "words", "palette", "mode", "accent", "type", "mount", "space", "motion"],
    words: [{ key: "name", label: "Your name" }, { key: "title", label: "Title, first part" }, { key: "titleEm", label: "Title, italic part" }, { key: "note", label: "Introduction", kind: "area" }],
    toContent: function (doc, resolve) { return L.toSalonContent(doc, PAGE, resolve); },
    fromContent: function (doc, c) { return L.fromSalonContent(doc, PAGE, c); },
    render: render,
    afterRender: fit,
    count: function (M) { return Object.keys(M.works).length; },
    onWord: function (k, v, c) {
      if (k === "title" || k === "titleEm") document.getElementById("title").innerHTML = c.esc(c.S.title) + " <em>" + c.esc(c.S.titleEm) + "</em>";
      else document.querySelector({ name: ".bar .name", note: ".card .note" }[k]).textContent = v;
    },
    /* how a work can hang */
    arrange: {
      options: function (M, bi) {
        var b = M.blocks[bi], hasNext = bi < M.blocks.length - 1;
        var withNext = { key: "with", d: "wall", t: "Hang with the next work", s: "Share a wall, on one eye line" };
        var alone = { key: "alone", d: "single", t: "End the wall here", s: "The next work starts a new wall" };
        if (b.hang === "with") { withNext.cur = true; return [withNext, alone]; }
        alone.cur = true; return hasNext ? [alone, withNext] : [alone];
      },
      apply: function (M, key, bi) { M.blocks[bi].hang = key; }
    },
    addWorks: function (M, after, ims, today) {
      var first = null, at = after + 1, prev = M.blocks[after];
      ims.forEach(function (im, k) {
        var id = "n" + Date.now().toString(36) + k, kk = DEFAULT_LONG / Math.max(im.w, im.h);
        M.works[id] = { assetId: im.assetId, src: im.src, w: im.w, h: im.h, title: "Untitled", date: String(new Date().getFullYear()), medium: "", alt: "Untitled", cmW: Math.round(im.w * kk * 10) / 10, cmH: Math.round(im.h * kk * 10) / 10 };
        if (!first) first = id;
        M.blocks.splice(at + k, 0, { type: "work", work: id, hang: prev && prev.hang === "with" ? "with" : "alone" });
      });
      return first;
    },
    removeWork: function (M, id) {
      var i = M.blocks.findIndex(function (b) { return b.work === id; }); if (i < 0) return;
      if (M.blocks[i].hang === "alone" && i > 0 && M.blocks[i - 1].hang === "with") M.blocks[i - 1].hang = "alone";
      M.blocks.splice(i, 1); delete M.works[id];
    },
    /* a work moves; the hang stays where it was, so the walls keep their shape */
    move: function (M, bi, dir) {
      var j = bi + dir; if (j < 0 || j >= M.blocks.length) return false;
      var a = M.blocks[bi], b = M.blocks[j], h = a.hang; a.hang = b.hang; b.hang = h; M.blocks[bi] = b; M.blocks[j] = a; return true;
    },
    afterText: function (M, d, x) { if (d.f === "cmW" || d.f === "cmH") x.draw(); },
    setText: function (M, d, v, before) {
      var w = M.works[d.w]; if (!w) return;
      if (d.f === "cmW" || d.f === "cmH") {
        var n = parseFloat(String(v).replace(",", ".")); if (!isFinite(n) || n < 1 || n > 2000) return;
        var ratio = w.w / w.h; n = Math.round(n * 10) / 10;
        if (d.f === "cmW") { w.cmW = n; w.cmH = Math.max(1, Math.round(n / ratio * 10) / 10); } else { w.cmH = n; w.cmW = Math.max(1, Math.round(n * ratio * 10) / 10); }
        return;
      }
      EN.blocks.setText(M, d, v, before);
    }
  });
})();
