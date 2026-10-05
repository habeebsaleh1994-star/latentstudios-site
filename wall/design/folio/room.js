/* Folio: one work at a time, held large and still. This file is only what is specific to Folio; the engine does the rest. */
(function () {
  var L = window.LatentStudio, EN = window.LatentEngine;
  var PAGE = "series";

  function render(c) {
    var S = c.S, M = c.M, ui = c.ui, esc = c.esc, editing = c.editing, plate = 0, last = M.blocks.length - 1;

    function figure(bi, id, first) {
      var w = M.works[id]; plate++; var n = ("0" + plate).slice(-2), r = (w.w / w.h).toFixed(3);
      return '<figure style="--r:' + r + '"><div class="frame"><img src="' + w.src + '" width="' + w.w + '" height="' + w.h + '" alt="' + esc(w.alt) + '"' + (first ? "" : ' loading="lazy"') + ">" +
        (editing ? ui.toolbar(bi, id) + (ui.arrangeOpen(id) ? ui.arrangePanel(bi, id) : "") : "") + "</div>" +
        '<figcaption><span class="n">' + n + "</span>" + (editing ? ui.cap(id, "title") : "<span>" + esc(w.title) + "</span>") + '<span class="d">' + (editing ? ui.cap(id, "date") : esc(w.date)) + "</span></figcaption></figure>";
    }
    function block(b, i) {
      if (b.type === "single") return '<div class="work single arrive">' + figure(i, b.work, i === 0) + "</div>";
      if (b.type === "pair") return '<div class="work pair arrive">' + b.works.map(function (id) { return figure(i, id); }).join("") + "</div>";
      if (b.type === "split") { var r = (M.works[b.work].w / M.works[b.work].h).toFixed(3); return '<div class="work split arrive" style="--r:' + r + '"><div class="side">' + (editing ? ui.text(i, "note", b.note, "p") : "<p>" + esc(b.note) + "</p>") + "</div>" + figure(i, b.work) + '<div class="side"></div></div>'; }
      if (b.type === "pause") return '<div class="interlude arrive"><span class="label">' + esc(b.label) + "</span>" + (editing ? ui.text(i, "text", b.text, "p") : "<p>" + esc(b.text) + "</p>") + "</div>";
      return "";
    }
    var seq = "";
    M.blocks.forEach(function (b, i) { seq += block(b, i) + (editing && i < last ? ui.addRow(i) : ""); });
    if (editing) seq += ui.addRow(last, true);

    return '<header class="bar"><a class="name" href="#top">' + esc(S.name) + '</a><nav aria-label="Primary"><a href="#work">Work</a><a href="#about">About</a><a href="#contact">Contact</a></nav></header>' +
      '<main id="top"><section class="card" aria-labelledby="title"><div><div class="label">' + esc(S.kicker) + '</div><h1 id="title">' + esc(S.title) + " <em>" + esc(S.titleEm) + '</em></h1></div><p class="note">' + esc(S.note) + "</p></section>" +
      '<div class="seq" id="work">' + seq + "</div></main>" +
      '<section class="about" id="about"><div class="about-in"><h2>' + esc(S.aboutTitle) + "</h2><div>" + S.about.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + '</div></div><div class="foot" id="contact"><span class="label">' + esc(S.contact) + '</span><a class="mark" href="#top" aria-label="Made with Latent Wall">l.</a></div></section>';
  }

  EN.run({
    name: "folio",
    accepts: function (d) { return d.pages.some(function (p) { return p.id === PAGE; }); },
    page: PAGE,
    options: [
      { key: "caption", title: "Caption", def: "below", choices: [["below", "Below"], ["beside", "Beside"], ["hidden", "Hidden"]] },
      { key: "size", title: "Picture", def: "large", choices: [["large", "Held large"], ["small", "Held small"]] }
    ],
    seed: "doc/before-it-disappears.studio.json",
    assets: "doc/assets.json",
    sections: ["look", "options", "words", "palette", "mode", "accent", "type", "mount", "space", "motion"],
    words: [{ key: "name", label: "Your name" }, { key: "title", label: "Title, first part" }, { key: "titleEm", label: "Title, italic part" }, { key: "note", label: "Introduction", kind: "area" }],
    toContent: function (doc, resolve) { return L.toFolioContent(doc, PAGE, resolve); },
    fromContent: function (doc, c) { return L.fromFolioContent(doc, PAGE, c); },
    render: render,
    count: function (M) { return Object.keys(M.works).length; },
    arrange: EN.blocks.arrange,
    onWord: function (k, v, c) {
      if (k === "title" || k === "titleEm") document.getElementById("title").innerHTML = c.esc(c.S.title) + " <em>" + c.esc(c.S.titleEm) + "</em>";
      else document.querySelector({ name: ".bar .name", note: ".card .note" }[k]).textContent = v;
    }
  });
})();
