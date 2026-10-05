/* Lantern: one slide at a time. A title slide, then each picture held in the middle of the screen; arrows, keys, swipe and a strip of small pictures move between them.
   Only what is specific to Lantern is here; the engine does the rest. */
(function () {
  var L = window.LatentStudio, EN = window.LatentEngine;
  var PAGE = "series", cur = 0, model = null, site = null, wasEditing = false;

  /* the slides, in order: the title, then every work (a pair or a note becomes its own slides), words as they come */
  function slides(M) {
    var out = [{ kind: "title" }];
    M.blocks.forEach(function (b, bi) {
      if (b.type === "pause") out.push({ kind: "words", b: b, bi: bi });
      else if (b.type === "pair") b.works.forEach(function (id) { out.push({ kind: "work", id: id, bi: bi }); });
      else out.push({ kind: "work", id: b.work, bi: bi, note: b.type === "split" ? b.note : "" });
    });
    return out;
  }
  function titleHtml(S, esc) {
    return '<section class="card" aria-labelledby="title"><div><div class="label">' + esc(S.kicker) + '</div><h1 id="title">' + esc(S.title) + " <em>" + esc(S.titleEm) + '</em></h1></div><p class="note">' + esc(S.note) + "</p></section>";
  }
  function workHtml(M, s, n, esc, ui, first) {
    var w = M.works[s.id], num = ("0" + n).slice(-2);
    return '<figure><div class="frame"><img src="' + w.src + '" width="' + w.w + '" height="' + w.h + '" alt="' + esc(w.alt) + '"' + (first ? "" : ' loading="lazy"') + ">" + (ui ? ui.toolbar(s.bi, s.id) : "") + "</div>" +
      '<figcaption><span class="n">' + num + "</span>" + (ui ? ui.cap(s.id, "title") : "<span>" + esc(w.title) + "</span>") + '<span class="d">' + (ui ? ui.cap(s.id, "date") : esc(w.date)) + "</span></figcaption></figure>";
  }

  var last = null; /* the latest drawing context: the engine's editing pieces (ui) and whether we are editing */
  function render(c) {
    var S = c.S, esc = c.esc;
    last = c; model = c.M; site = S; var list = slides(c.M); if (cur >= list.length) cur = list.length - 1;
    var head = '<header class="bar"><a class="name" href="#top">' + esc(S.name) + '</a><nav aria-label="Primary"><a href="#show">Work</a><a href="#about">About</a><a href="#contact">Contact</a></nav></header>';
    var about = '<section class="about" id="about"><div class="about-in"><h2>' + esc(S.aboutTitle) + "</h2><div>" + S.about.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + '</div></div><div class="foot" id="contact"><span class="label">' + esc(S.contact) + '</span><a class="mark" href="#top" aria-label="Made with Latent Wall">l.</a></div></section>';
    return head + '<main id="top"><div class="show" id="show" aria-roledescription="slideshow" aria-label="' + esc(S.title) + '"><div class="stage" id="stage"></div><div class="thumbs" id="thumbs" role="group" aria-label="All slides"></div></div></main>' + about;
  }

  /* draw the slide being shown and the strip of small pictures; in editing, the same slide carries its own controls */
  function stage() {
    var st = document.getElementById("stage"); if (!st || !model || !last) return;
    var ui = last.editing ? last.ui : null, list = slides(model), s = list[cur], esc = EN.esc, n = 0;
    for (var i = 0; i <= cur; i++) if (list[i].kind === "work") n++;
    var inner;
    if (s.kind === "title") inner = '<div class="slide title fade">' + titleHtml(site, esc) + "</div>";
    else if (s.kind === "words") inner = '<div class="slide words fade"><span class="label">' + esc(s.b.label) + "</span>" + (ui ? ui.text(s.bi, "text", s.b.text, "p") : "<p>" + esc(s.b.text) + "</p>") + "</div>";
    else inner = '<div class="slide fade">' + workHtml(model, s, n, esc, ui, true) + (ui && s.note ? ui.text(s.bi, "note", s.note, "p", "label") : s.note ? '<p class="label" style="margin:10px 0 0">' + esc(s.note) + "</p>" : "") + "</div>";
    st.innerHTML = inner + '<button type="button" class="arrow prev" aria-label="Previous slide"' + (cur === 0 ? " disabled" : "") + '>&lsaquo;</button><button type="button" class="arrow next" aria-label="Next slide"' + (cur === list.length - 1 ? " disabled" : "") + ">&rsaquo;</button>";
    st.setAttribute("aria-live", "polite");
    var th = document.getElementById("thumbs"), k = 0;
    th.innerHTML = list.map(function (x, i) {
      if (x.kind === "title") return '<button type="button" data-go="0" aria-label="Title slide" aria-current="' + (cur === 0) + '"><span class="t0">Title</span></button>';
      if (x.kind === "words") return '<button type="button" data-go="' + i + '" aria-label="Words: ' + esc(x.b.label) + '" aria-current="' + (cur === i) + '"><span class="t0">&ldquo;&rdquo;</span></button>';
      k++; var w = model.works[x.id];
      return '<button type="button" data-go="' + i + '" aria-label="Photograph ' + k + ": " + esc(w.title) + '" aria-current="' + (cur === i) + '"><img src="' + w.src + '" width="' + w.w + '" height="' + w.h + '" alt="" loading="lazy"></button>';
    }).join("");
    if (ui) th.insertAdjacentHTML("beforeend", ui.addRow(s.bi == null ? -1 : s.bi, true).replace("Add photographs", "Add photographs after this one"));
    var on = th.querySelector('[aria-current="true"]'); if (on && th.scrollWidth > th.clientWidth) th.scrollLeft = on.offsetLeft - th.clientWidth / 2 + on.offsetWidth / 2;
  }
  function go(i) {
    if (!model) return; var max = slides(model).length - 1; i = Math.max(0, Math.min(max, i)); if (i === cur) return; cur = i; stage();
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest(".arrow.prev")) go(cur - 1); else if (e.target.closest(".arrow.next")) go(cur + 1);
    else { var t = e.target.closest("[data-go]"); if (t) go(+t.dataset.go); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.target.isContentEditable || (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); }
  });
  var x0 = null;
  document.addEventListener("touchstart", function (e) { x0 = e.target.closest("#stage") && !e.target.closest("[contenteditable], .tb") && e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  document.addEventListener("touchend", function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 48) go(cur + (dx < 0 ? 1 : -1)); }, { passive: true });

  /* a new, moved or removed slide keeps the editor on the slide they were working on */
  function slideOf(M, test) { var l = slides(M); for (var i = 0; i < l.length; i++) if (test(l[i])) return i; return -1; }

  EN.run({
    name: "lantern",
    accepts: function (d) { return d.room === "lantern" && d.pages.some(function (p) { return p.id === PAGE; }); },
    page: PAGE,
    options: [
      { key: "thumbs", title: "Small pictures", def: "strip", choices: [["strip", "Below"], ["none", "Hidden"]] },
      { key: "stage", title: "Picture", def: "held", choices: [["held", "Held"], ["full", "Filling the screen"]] }
    ],
    seed: "doc/lantern.studio.json",
    assets: "doc/assets.json",
    sections: ["look", "options", "words", "palette", "mode", "accent", "type", "mount", "space", "motion"],
    words: [{ key: "name", label: "Your name" }, { key: "title", label: "Title, first part" }, { key: "titleEm", label: "Title, italic part" }, { key: "note", label: "Introduction", kind: "area" }],
    toContent: function (doc, resolve) { return L.toFolioContent(doc, PAGE, resolve); },
    fromContent: function (doc, c) { return L.fromFolioContent(doc, PAGE, c); },
    render: render,
    afterRender: function (c) { if (c.editing && !wasEditing && cur === 0 && slides(c.M).length > 1) cur = 1; wasEditing = c.editing; last = c; stage(); },
    move: function (M, bi, dir) { var ok = EN.blocks.move(M, bi, dir); if (ok) { var i = slideOf(M, function (x) { return x.bi === bi + dir; }); if (i > -1) cur = i; } return ok; },
    addWorks: function (M, after, ims, today) { var id = EN.blocks.add(M, after, ims, today), i = slideOf(M, function (x) { return x.id === id; }); if (i > -1) cur = i; return id; },
    count: function (M) { return Object.keys(M.works).length; },
    onWord: function (k, v, c) {
      if (k === "title" || k === "titleEm") { var t = document.getElementById("title"); if (t) t.innerHTML = c.esc(c.S.title) + " <em>" + c.esc(c.S.titleEm) + "</em>"; }
      else { var n = document.querySelector({ name: ".bar .name", note: ".card .note" }[k]); if (n) n.textContent = v; }
    }
  });
})();
