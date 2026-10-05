/* Index: type leads. A contents rail that follows the reader, and pages that read like a book.
   Only what is specific to Index is here; the engine does the rest. */
(function () {
  var L = window.LatentStudio, EN = window.LatentEngine;
  var KINDS = ["Poem", "Essay", "Fragment"];

  function num(i) { return ("0" + (i + 1)).slice(-2); }

  function render(c) {
    var S = c.S, M = c.M, esc = c.esc, ui = c.ui, editing = c.editing;
    function ce(attrs, text, tag, cls, ph, multiline) { return "<" + tag + (cls ? ' class="' + cls + '"' : "") + ' contenteditable="plaintext-only" spellcheck="false" ' + attrs + (ph ? ' data-ph="' + ph + '"' : "") + (multiline ? " data-multiline" : "") + ">" + esc(text) + "</" + tag + ">"; }
    function figure(pc) {
      var im = pc.image; if (!im) return "";
      return '<figure style="--r:' + (im.w / im.h).toFixed(3) + '"><div class="frame"><img src="' + im.src + '" width="' + im.w + '" height="' + im.h + '" alt="' + esc(im.alt) + '" loading="lazy"></div>' +
        (editing ? "<figcaption>" + ce('data-p="' + pc.id + '" data-f="caption"', im.caption, "span", "", "Add a caption") + "</figcaption>" : (im.caption ? "<figcaption>" + esc(im.caption) + "</figcaption>" : "")) + "</figure>";
    }
    function paraAdd(pc, i) { return editing && pc.kind !== "poem" ? '<div class="addrow tight"><button type="button" data-act="p-para" data-p="' + pc.id + '" data-i="' + i + '" aria-label="Add a paragraph here">+</button></div>' : ""; }
    function body(pc) {
      if (pc.kind === "poem") return editing ? ce('data-p="' + pc.id + '" data-f="para" data-i="0"', pc.paras[0] || "", "p", "poem", "Write here", true) : '<p class="poem">' + esc(pc.paras[0] || "") + "</p>";
      var h = ""; var cls = pc.kind === "essay" ? "prose" : "fragment";
      pc.paras.forEach(function (t, i) {
        h += editing ? ce('data-p="' + pc.id + '" data-f="para" data-i="' + i + '"', t, "p", "", "Write here") : "<p>" + esc(t) + "</p>";
        if (pc.image && pc.image.at === i + 1) h += figure(pc);
        h += paraAdd(pc, i);
      });
      return '<div class="' + cls + '">' + h + "</div>";
    }
    function tools(pc, i) {
      var last = M.pieces.length - 1, hasImg = !!pc.image;
      return '<div class="tb ptb" role="toolbar" aria-label="Edit this piece">' +
        '<button type="button" data-act="p-photo" data-p="' + pc.id + '">' + (hasImg ? "Replace photo" : "Add photo") + "</button>" +
        (hasImg ? '<button type="button" data-act="p-photo-del" data-p="' + pc.id + '">Remove photo</button>' : "") +
        (hasImg && pc.kind !== "poem" && pc.paras.length > 1 ? '<button type="button" data-act="p-photo-at" data-p="' + pc.id + '">' + (pc.image.at === "cover" ? "Set in text" : "Make cover") + "</button>" : "") +
        '<button type="button" data-act="p-form" data-p="' + pc.id + '">' + esc(pc.form) + " &rsaquo;</button>" +
        '<button type="button" data-act="p-up" data-p="' + pc.id + '"' + (i === 0 ? " disabled" : "") + ' aria-label="Move earlier">&uarr;</button>' +
        '<button type="button" data-act="p-down" data-p="' + pc.id + '"' + (i === last ? " disabled" : "") + ' aria-label="Move later">&darr;</button>' +
        '<button type="button" data-act="p-del" data-p="' + pc.id + '">Delete</button></div>';
    }

    var rail = M.pieces.map(function (p, i) { return '<li><a href="#' + p.id + '" data-id="' + p.id + '"><span class="n">' + num(i) + '</span><span class="t">' + esc(p.title) + '</span><span class="f">' + esc(p.form) + (p.year ? " · " + esc(p.year) : "") + "</span></a></li>"; }).join("");
    if (editing) rail += '<li class="newp"><button type="button" data-act="p-new" data-after="' + (M.pieces.length - 1) + '">+ New piece</button></li>';

    var pieces = M.pieces.map(function (pc, i) {
      var meta = editing ? num(i) + " · " + esc(pc.form) + " · " + ce('data-p="' + pc.id + '" data-f="place"', pc.place, "span", "", "Place") + ", " + ce('data-p="' + pc.id + '" data-f="year"', pc.year, "span", "", "Year") : num(i) + " · " + esc(pc.form) + (pc.place || pc.year ? " · " + esc([pc.place, pc.year].filter(Boolean).join(", ")) : "");
      var cover = pc.image && pc.image.at === "cover" ? figure(pc) : "";
      var margin = editing ? '<p class="margin">' + ce('data-p="' + pc.id + '" data-f="margin"', pc.margin, "span", "", "Add a note under the piece") + "</p>" : (pc.margin ? '<p class="margin">' + esc(pc.margin) + "</p>" : "");
      return '<article class="piece arrive" id="' + pc.id + '" aria-labelledby="h-' + pc.id + '"><header><span class="label">' + meta + "</span>" + (editing ? ce('data-p="' + pc.id + '" data-f="title" id="h-' + pc.id + '"', pc.title, "h2", "", "Title") : '<h2 id="h-' + pc.id + '">' + esc(pc.title) + "</h2>") + "</header>" + (editing ? tools(pc, i) : "") + cover + body(pc) + margin + "</article>";
    }).join("");
    if (editing) pieces += '<div class="addrow end"><button type="button" data-act="p-new" data-after="' + (M.pieces.length - 1) + '">New piece</button></div>';

    return '<header class="bar"><a class="name" href="#top">' + esc(S.name) + '</a><nav aria-label="Primary"><a href="#writing">Writing</a><a href="#about">About</a><a href="#contact">Contact</a></nav></header>' +
      '<main id="top"><section class="card" aria-labelledby="title"><div><div class="label">' + esc(S.kicker) + '</div><h1 id="title">' + esc(S.title) + " <em>" + esc(S.titleEm) + '</em></h1></div><p class="note">' + esc(S.note) + "</p></section>" +
      '<div class="book" id="writing"><nav class="rail" aria-label="Contents"><span class="label">Contents · ' + M.pieces.length + ' pieces</span><ol>' + rail + '</ol></nav><div class="pieces">' + pieces + "</div></div></main>" +
      '<section class="about" id="about"><div class="about-in"><h2>' + esc(S.aboutTitle) + "</h2><div>" + S.about.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + '</div></div><div class="foot" id="contact"><span class="label">' + esc(S.contact) + '</span><a class="mark" href="#top" aria-label="Made with Latent Wall">l.</a></div></section>';
  }

  /* the contents rail marks the piece you are reading; a thin line shows how far through the page you are */
  var spy, bar = document.getElementById("progress");
  function progress() { var h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, scrollY / h) : 0) + ")"; }
  addEventListener("scroll", progress, { passive: true }); addEventListener("resize", progress);
  function afterRender() {
    if (spy) spy.disconnect();
    if ("IntersectionObserver" in window) {
      spy = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) document.querySelectorAll(".rail a").forEach(function (a) { a.setAttribute("aria-current", a.dataset.id === e.target.id ? "true" : "false"); }); }); }, { rootMargin: "-30% 0px -55% 0px" });
      document.querySelectorAll(".piece").forEach(function (p) { spy.observe(p); });
    }
    var first = document.querySelector(".rail a"); if (first && !document.querySelector('.rail a[aria-current="true"]')) first.setAttribute("aria-current", "true");
    progress();
  }

  function pieceById(M, id) { for (var i = 0; i < M.pieces.length; i++) if (M.pieces[i].id === id) return i; return -1; }
  function kindOf(f) { return f.toLowerCase().indexOf("poem") > -1 ? "poem" : f.toLowerCase().indexOf("essay") > -1 ? "essay" : "fragment"; }

  EN.run({
    name: "index",
    accepts: function (d) { return d.pages.some(function (p) { return p.kind === "writing"; }); },
    page: "writing",
    options: [
      { key: "rail", title: "Contents", def: "left", choices: [["left", "Left"], ["right", "Right"], ["top", "Top"]] },
      { key: "poems", title: "Poems", def: "flush", choices: [["flush", "Flush left"], ["centre", "Centred"]] }
    ],
    seed: "doc/noor-rahal.studio.json",
    assets: "doc/assets.json",
    sections: ["look", "options", "words", "palette", "mode", "accent", "type", "mount", "read", "space", "motion"],
    words: [{ key: "name", label: "Your name" }, { key: "title", label: "Title, first part" }, { key: "titleEm", label: "Title, italic part" }, { key: "note", label: "Introduction", kind: "area" }],
    toContent: function (doc, resolve) { return L.toIndexContent(doc, resolve); },
    fromContent: function (doc, c) { return L.fromIndexContent(doc, c); },
    render: render,
    afterRender: afterRender,
    count: function (M) { return M.pieces.filter(function (p) { return p.image; }).length; },
    onWord: function (k, v, c) {
      if (k === "title" || k === "titleEm") document.getElementById("title").innerHTML = c.esc(c.S.title) + " <em>" + c.esc(c.S.titleEm) + "</em>";
      else document.querySelector({ name: ".bar .name", note: ".card .note" }[k]).textContent = v;
    },
    /* words typed in place */
    setText: function (M, d, v) {
      var i = pieceById(M, d.p); if (i < 0) return; var pc = M.pieces[i];
      if (d.f === "para") { pc.paras[+d.i] = v; if (pc.kind !== "poem" && v === "" && pc.paras.length > 1) pc.paras.splice(+d.i, 1); }
      else if (d.f === "caption") { if (pc.image) pc.image.caption = v; }
      else pc[d.f] = v;
    },
    /* what Index's own buttons do */
    act: function (a, t, x) {
      var M = x.M, i = pieceById(M, t.dataset.p), pc = M.pieces[i];
      if (a === "p-new") {
        x.snap(); var at = +t.dataset.after + 1;
        M.pieces.splice(at, 0, { id: "p" + Date.now().toString(36), title: "Untitled", form: "Poem", place: "", year: String(new Date().getFullYear()), kind: "poem", paras: [""], margin: "", image: null });
        x.draw(); var n = document.querySelectorAll(".piece")[at]; n && n.scrollIntoView({ block: "start" });
      } else if (a === "p-up" || a === "p-down") { var j = a === "p-up" ? i - 1 : i + 1; if (j < 0 || j >= M.pieces.length) return; x.snap(); var tmp = M.pieces[i]; M.pieces[i] = M.pieces[j]; M.pieces[j] = tmp; x.draw(); }
      else if (a === "p-del") { x.snap(); M.pieces.splice(i, 1); x.draw(); x.toast("Deleted. Undo brings it back."); }
      else if (a === "p-form") {
        x.snap(); var next = KINDS[(KINDS.indexOf(pc.form) + 1) % KINDS.length]; var was = pc.kind; pc.form = next; pc.kind = kindOf(next);
        if (pc.kind === "poem" && was !== "poem") { pc.paras = [pc.paras.join("\n\n")]; if (pc.image && pc.image.at !== "cover") pc.image.at = "cover"; }
        else if (pc.kind !== "poem" && was === "poem") pc.paras = (pc.paras[0] || "").split(/\n{2,}/);
        x.draw();
      }
      else if (a === "p-photo") x.pick({ piece: pc.id, replace: !!pc.image }, false);
      else if (a === "p-photo-del") { x.snap(); pc.image = null; x.draw(); }
      else if (a === "p-photo-at") { x.snap(); pc.image.at = pc.image.at === "cover" ? 1 : "cover"; x.draw(); }
      else if (a === "p-para") { x.snap(); pc.paras.splice(+t.dataset.i + 1, 0, ""); if (pc.image && typeof pc.image.at === "number" && pc.image.at > +t.dataset.i + 1) pc.image.at += 1; x.draw(); var p2 = document.querySelectorAll('[data-p="' + pc.id + '"][data-f="para"]')[+t.dataset.i + 1]; p2 && p2.focus(); }
    },
    onImages: function (M, meta, ims) {
      var pc = M.pieces[pieceById(M, meta.piece)]; if (!pc) return; var im = ims[0], prev = pc.image;
      pc.image = { assetId: im.assetId, src: im.src, w: im.w, h: im.h, alt: prev ? prev.alt : "", caption: prev ? prev.caption : "", at: prev ? prev.at : "cover" };
    }
  });
})();
