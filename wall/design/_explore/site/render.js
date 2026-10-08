/* Renders the site from the document: the front page in its form, each page in its arrangement, the navigation drawn from the pages.
   In edit mode the same renderer adds the editor's marks: words that can be typed into, a toolbar on each work, a "+" in each gap. */
(function () {
  var M = window.SiteModel, esc = M.esc, app = document.getElementById("app"), root = document.documentElement;
  var STATIC = window.STATIC || null;
  var ST = window.SiteState = { doc: STATIC ? STATIC.doc : M.load(), editing: false, view: "", page: null, base: STATIC ? STATIC.base : "", published: /[?&]published/.test(location.search) };
  var q = location.search.replace(/[?&](reset|new|edit|panel|lib)(=[^&]*)?/g, "").replace(/^&/, "?");
  function href(path) { if (ST.base !== null && (STATIC || ST.building)) return path === "/" ? (ST.base || "./") : ST.base + path.slice(1) + "/"; return q + "#" + path; }
  function src(w) { return (STATIC || ST.building) ? ST.base + "assets/img/" + w.file : w.src; }
  function E(field, val, extra) { var e = ST.editing; return "<span" + (e ? ' contenteditable="true" data-ed="' + field + '"' + (extra || "") : "") + ">" + esc(val) + "</span>"; }
  function title(p, pre) { return E((pre || "") + "title", p.title) + (p.titleEm || ST.editing ? " <em>" + E((pre || "") + "titleEm", p.titleEm) + "</em>" : ""); }
  function cap(w, date) { var k = ' data-k="' + w.k + '"'; return '<p class="cap"><span class="n">' + w.n + "</span>" + E("item.title", w.title, k) + (date === false ? "" : '<span class="d">' + E("item.date", w.date, k) + "</span>") + "</p>"; }
  function img(w, lazy) { return '<img src="' + src(w) + '" width="' + Math.round(1000 * w.r) + '" height="1000" alt="' + esc(w.alt) + '" style="--r:' + w.r + '"' + (lazy ? ' loading="lazy"' : "") + ">"; }
  function stories() { return ST.doc.pages.filter(function (p) { return p.kind === "story"; }); }
  function bar(on) {
    var links = [];
    if (stories().length) links.push(["/", "Stories"]);
    ST.doc.pages.forEach(function (p) { if (p.kind !== "story" && p.inNav) links.push(["/" + p.id, p.title + (p.titleEm ? " " + p.titleEm : "")]); });
    return '<header class="bar"><a class="name" href="' + href("/") + '">' + E("site.name", ST.doc.name) + '</a><nav aria-label="Primary">' + links.map(function (l) { return '<a href="' + href(l[0]) + '"' + (on === l[0] ? ' class="on"' : "") + ">" + esc(l[1]) + "</a>"; }).join("") + "</nav></header>";
  }
  function foot() { return '<footer class="foot"><span class="label">' + E("site.contact", ST.doc.contact) + '</span><a class="mark" href="' + href("/") + '" aria-label="Made with Latent Wall">l.</a></footer>'; }
  function next(p) { var s = stories(), i = s.map(function (x) { return x.id; }).indexOf(p.id), n = s[(i + 1) % s.length]; return n && n.id !== p.id ? M.view(n) : null; }
  function onward(p) { var n = next(p); return n ? '<div class="onward"><a href="' + href("/" + n.id) + '"><span class="label">Next story</span><span class="big">' + esc(n.title) + (n.titleEm ? " <em>" + esc(n.titleEm) + "</em>" : "") + "</span></a></div>" : ""; }
  function pageTb(p, i, list) { return ST.editing ? '<span class="tb pg"><button type="button" data-act="page-up" data-id="' + p.id + '"' + (i === 0 ? " disabled" : "") + ' aria-label="Move up">&uarr;</button><button type="button" data-act="page-down" data-id="' + p.id + '"' + (i === list.length - 1 ? " disabled" : "") + ' aria-label="Move down">&darr;</button><button type="button" data-act="page-nav" data-id="' + p.id + '">' + (p.inNav ? "Shown" : "Hidden") + "</button></span>" : ""; }
  function newStory() { return ST.editing ? '<div class="addrow end"><button type="button" data-act="page-add" data-kind="story">+ New story</button></div>' : ""; }
  function empty(p) { return '<div class="seq"><div class="new">No photographs yet.' + (ST.editing ? ' <button type="button" data-act="lib" data-page="' + p.id + '" data-after="-1" style="background:none;border:0;color:var(--ed-accent);font:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:3px">Add some from your library</button>' : " Press Edit to add some.") + "</div></div>"; }

  /* ---- the front page, three forms ---- */
  function frontCard() { return '<section class="card"><div><span class="label">' + E("site.kicker", ST.doc.kicker) + "</span><h1>" + title(ST.doc, "site.") + '</h1></div><p class="note">' + E("site.note", ST.doc.note) + "</p></section>"; }
  function listed() { return ST.doc.pages.filter(function (p) { return (p.kind === "story" || p.kind === "writing") && (p.inNav || ST.editing); }).map(M.view); }
  var fronts = {
    covers: function () {
      var s = listed().filter(function (p) { return p.kind === "story"; });
      return "<main>" + frontCard() + '<div class="covers">' + s.map(function (p, i) {
        return '<div class="cover" style="--r:' + (p.cover ? p.cover.r : 1.5) + '">' + pageTb(p, i, s) + '<a href="' + href("/" + p.id) + '">' + (p.cover ? img(p.cover, i > 0) : '<div class="new">No photographs yet</div>') + '<div class="under"><h2>' + esc(p.title) + (p.titleEm ? " <em>" + esc(p.titleEm) + "</em>" : "") + '</h2><span class="label">' + esc(p.meta) + "</span></div></a></div>";
      }).join("") + newStory() + "</div></main>" + foot();
    },
    list: function () {
      var items = listed();
      return "<main>" + frontCard() + '<div class="ledger"><ol>' + items.map(function (p, i) { return '<li class="' + p.kind + (p.inNav ? "" : " off") + '">' + pageTb(p, i, items) + '<a href="' + href("/" + p.id) + '" data-i="' + i + '"><span class="n">' + ("0" + (i + 1)).slice(-2) + "</span><h2>" + esc(p.title) + (p.titleEm ? " <em>" + esc(p.titleEm) + "</em>" : "") + '</h2><span class="m">' + esc(p.kind === "story" ? p.meta : p.kicker) + "</span></a></li>"; }).join("") +
        "</ol>" + newStory() + '<div class="show" id="ledgerheld">' + (items[0] ? ledgerPick(items[0]) : "") + "</div></div></main>" + foot();
    },
    sheet: function () {
      var items = listed();
      return "<main>" + frontCard() + '<div class="sheetfront">' + items.map(function (p, i) {
        return '<div class="' + p.kind + '">' + pageTb(p, i, items) + '<a href="' + href("/" + p.id) + '">' + (p.kind === "story" ? '<span class="fr">' + (p.cover ? img(p.cover) : "") + "</span>" : '<span class="fr">' + esc(p.text.split("\n\n")[0]) + "</span>") + "<h2>" + esc(p.title) + (p.titleEm ? " <em>" + esc(p.titleEm) + "</em>" : "") + '</h2><span class="label">' + esc(p.kind === "story" ? p.meta : p.kicker) + "</span></a></div>";
      }).join("") + "</div>" + newStory() + "</main>" + foot();
    }
  };
  function ledgerPick(p) { var w = p.cover || p.image; return (w ? img(w) : "") + '<p class="cap"><span class="n">' + esc(p.kind === "story" ? p.count + " photographs" : "A poem") + "</span><span>" + esc(p.title + (p.titleEm ? " " + p.titleEm : "")) + "</span></p>"; }

  /* ---- a story, in its arrangement ---- */
  function card(p) { return '<section class="card"><div><span class="label">' + E("page.kicker", p.kicker) + "</span><h1>" + title(p, "page.") + '</h1></div><p class="note">' + E("page.note", p.note) + "</p></section>"; }
  function tb(w, p) {
    if (!ST.editing) return "";
    var k = w.k, last = p.items.length - 1;
    return '<span class="tb"><button type="button" data-act="arrange" data-k="' + k + '">Arrange</button><button type="button" data-act="item-up" data-k="' + k + '"' + (k === 0 ? " disabled" : "") + ' aria-label="Move earlier">&uarr;</button><button type="button" data-act="item-down" data-k="' + k + '"' + (k === last ? " disabled" : "") + ' aria-label="Move later">&darr;</button><button type="button" data-act="moveto" data-k="' + k + '">Move to</button><button type="button" data-act="item-remove" data-k="' + k + '">Remove</button></span>' + (ST.arrOpen === k ? arrPanel(w, p) : "");
  }
  function arrPanel(w, p) {
    var opts = window.SiteEdit.arrangeOptions(p, w.k), isMove = ST.arrMode === "moveto";
    if (isMove) opts = stories().filter(function (s) { return s.id !== p.id; }).map(function (s) { return { key: "to:" + s.id, t: s.title + (s.titleEm ? " " + s.titleEm : ""), s: M.count(s) + " photographs", d: "single" }; }).concat([{ key: "to:new", t: "A new story", s: "Starts a story with this photograph", d: "single" }]);
    return '<div class="arr"><h4>' + (isMove ? "Move to" : "How it sits") + "</h4>" + opts.map(function (o) { return '<button type="button" data-act="arr" data-k="' + w.k + '" data-key="' + o.key + '"' + (o.cur ? ' aria-current="true"' : "") + ">" + diagram(o.d) + "<span>" + esc(o.t) + "<small>" + esc(o.s) + "</small></span></button>"; }).join("") + "</div>";
  }
  function diagram(kind) { return kind === "pair" ? '<span class="dg dg-pair"><i class="me"></i><i></i></span>' : kind === "pair-prev" ? '<span class="dg dg-pair"><i></i><i class="me"></i></span>' : kind === "split" ? '<span class="dg dg-split"><i></i><i class="me"></i><i></i></span>' : '<span class="dg dg-single"><i class="me"></i></span>'; }
  function addRow(p, afterK, end) { return ST.editing ? '<div class="addrow' + (end ? " end" : "") + '"><button type="button" data-act="lib" data-page="' + p.id + '" data-after="' + afterK + '">+' + (end ? " Add photographs" : "") + "</button></div>" : ""; }
  function held(p) {
    if (!p.works.length) return "<main>" + card(p) + empty(p) + onward(p) + "</main>" + foot();
    var html = "", lastK = p.items.length - 1;
    p.groups.forEach(function (g, i) {
      var a = g.works && g.works[0], endK = g.type === "pause" ? g.k : g.works[g.works.length - 1].k;
      if (g.type === "pause") html += '<div class="interlude"><span class="label">' + E("pause.label", g.label, ' data-k="' + g.k + '"') + "</span><p>" + E("pause.text", g.text, ' data-k="' + g.k + '"') + "</p>" + (ST.editing ? '<p style="grid-column:3/span 6;margin:14px 0 0"><button type="button" data-act="item-remove" data-k="' + g.k + '" class="tb" style="position:static;opacity:1;display:inline-flex"><span style="padding:9px 11px;font:500 10.5px/1 var(--ed-font);letter-spacing:.13em;text-transform:uppercase;color:var(--ed-soft)">Remove the pause</span></button></p>' : "") + "</div>";
      else if (g.type === "pair") html += '<div class="work pair">' + g.works.map(function (w) { return '<figure style="--r:' + w.r + '">' + img(w, i > 0) + tb(w, p) + "<figcaption>" + cap(w) + "</figcaption></figure>"; }).join("") + "</div>";
      else if (g.type === "note") html += '<div class="work split" style="--r:' + a.r + '"><div class="side"><p>' + E("item.note", g.note, ' data-k="' + a.k + '"') + '</p></div><figure style="--r:' + a.r + '">' + img(a, i > 0) + tb(a, p) + "<figcaption>" + cap(a) + '</figcaption></figure><div class="side"></div></div>';
      else html += '<div class="work single"><figure style="--r:' + a.r + '">' + img(a, i > 0) + tb(a, p) + "<figcaption>" + cap(a) + "</figcaption></figure></div>";
      if (endK < lastK) html += addRow(p, endK);
    });
    html += addRow(p, lastK, true);
    return "<main>" + card(p) + '<div class="seq">' + html + "</div>" + onward(p) + "</main>" + foot();
  }

  var book = { leaves: [], at: 0 };
  function bookBuild(p) {
    var one = window.matchMedia("(max-width: 700px)").matches, out = [], n = next(p);
    function pg(h, c) { return '<div class="pg ' + (c || "") + '">' + h + "</div>"; }
    function plate(w, extra) { return '<figure><div class="in">' + img(w) + cap(w) + (extra || "") + "</div></figure>"; }
    function bare(w) { return '<figure><div class="in">' + img(w) + "</div></figure>"; }
    var top = '<div class="top"><span class="label">' + E("page.kicker", p.kicker) + "</span></div>", h1 = "<h1>" + title(p, "page.") + "</h1>";
    var onwardPg = n ? '<div class="low"><a href="' + href("/" + n.id) + '"><span class="label">Next story</span><span class="big">' + esc(n.title) + (n.titleEm ? " <em>" + esc(n.titleEm) + "</em>" : "") + "</span></a></div>" : "";
    if (one) out.push(pg(top + '<div class="low">' + h1 + "<p>" + E("page.note", p.note) + "</p></div>"));
    else out.push(pg(top + '<div class="low"><p>' + E("page.note", p.note) + "</p></div>") + pg('<div class="low">' + h1 + "</div>"));
    p.groups.forEach(function (g) {
      var a = g.works && g.works[0], k = a ? ' data-k="' + a.k + '"' : ' data-k="' + g.k + '"';
      if (g.type === "pause") out.push(one ? pg('<div class="top"><span class="label">' + E("pause.label", g.label, k) + '</span></div><div class="say"><p>' + E("pause.text", g.text, k) + "</p></div>") : pg('<div class="foot2"><span class="label">' + E("pause.label", g.label, k) + "</span></div>") + pg('<div class="say"><p>' + E("pause.text", g.text, k) + "</p></div>"));
      else if (g.type === "pair") { if (one) g.works.forEach(function (w) { out.push(pg(plate(w))); }); else out.push(pg(plate(a)) + pg(plate(g.works[1]))); }
      else if (a.full && !one) out.push(pg(plate(a), "wide"));
      else if (one) out.push(pg(plate(a, g.note ? '<p class="aside">' + E("item.note", g.note, k) + "</p>" : "")));
      else out.push(pg('<div class="foot2">' + (g.note ? '<p class="aside">' + E("item.note", g.note, k) + "</p>" : "") + cap(a) + "</div>") + pg(bare(a)));
    });
    if (!p.works.length) out.push(pg('<div class="say"><p style="font-size:clamp(16px,1.6cqw,22px);color:var(--ink-soft)">No photographs yet. Add some under This page.</p></div>'));
    if (onwardPg) out.push(one ? pg(onwardPg) : pg("") + pg(onwardPg));
    book.leaves = out; book.at = Math.min(book.at, out.length - 1);
  }
  function bookShow(i, quick) {
    var el = document.getElementById("spread"); if (!el) return;
    book.at = Math.max(0, Math.min(book.leaves.length - 1, i));
    function put() {
      el.innerHTML = book.leaves[book.at] + (ST.editing ? "" : '<button class="zone prev" tabindex="-1" aria-hidden="true"></button><button class="zone next" tabindex="-1" aria-hidden="true"></button>');
      document.getElementById("count").textContent = (book.at + 1) + " / " + book.leaves.length;
      document.getElementById("prev").disabled = book.at === 0; document.getElementById("next").disabled = book.at === book.leaves.length - 1;
      el.classList.remove("turning");
    }
    if (quick) return put(); el.classList.add("turning"); setTimeout(put, 300);
  }
  function bookGo(d) { if (book.at + d >= 0 && book.at + d < book.leaves.length) bookShow(book.at + d); }
  function bookPage(p) { bookBuild(p); return '<main class="book"><div class="stage"><div class="spread" id="spread" aria-live="polite"></div></div><div class="turn"><button id="prev" aria-label="Previous page">&#8249;</button><span class="label" id="count"></span><button id="next" aria-label="Next page">&#8250;</button></div></main>'; }

  function passage(p) {
    var n = next(p);
    function hang(w, cls, aside) { return '<figure class="hang ' + (w.r < 1 ? "tall " : "") + (cls || "") + '" style="--r:' + w.r + '" data-n="' + w.n + '">' + (aside ? '<p class="aside">' + E("item.note", aside, ' data-k="' + w.k + '"') + "</p>" : "") + img(w) + '<figcaption class="cap"><span class="n">' + w.n + "</span>" + E("item.title", w.title, ' data-k="' + w.k + '"') + '<span class="d">' + E("item.date", w.date, ' data-k="' + w.k + '"') + "</span></figcaption></figure>"; }
    var html = '<section class="wall title"><span class="label">' + E("page.kicker", p.kicker) + "</span><h1>" + title(p, "page.") + "</h1><p>" + E("page.note", p.note) + "</p></section>";
    p.groups.forEach(function (g) {
      if (g.type === "pause") html += '<section class="wall say"><span class="label">' + E("pause.label", g.label, ' data-k="' + g.k + '"') + "</span><p>" + E("pause.text", g.text, ' data-k="' + g.k + '"') + "</p></section>";
      else if (g.type === "pair") html += hang(g.works[0]) + hang(g.works[1], "close");
      else html += hang(g.works[0], g.note ? "noted" : "", g.note);
    });
    if (!p.works.length) html += '<section class="wall say"><p style="font-size:22px;color:var(--ink-soft)">No photographs yet. Add some under This page.</p></section>';
    if (n) html += '<section class="wall end"><a href="' + href("/" + n.id) + '"><span class="label">Next story</span><span class="big">' + esc(n.title) + (n.titleEm ? " <em>" + esc(n.titleEm) + "</em>" : "") + "</span></a></section>";
    return '<main class="walk" id="walk" tabindex="0" aria-label="The story, hung in order. Scroll or use the arrow keys to walk along it.">' + html + '</main><footer class="rail"><span class="label title">' + esc(p.title + " " + (p.titleEm || "")) + '</span><div class="line"><i id="pos"></i></div><span class="label" id="at"></span></footer>';
  }
  function passageWire() {
    var walk = document.getElementById("walk"), pos = document.getElementById("pos"), atEl = document.getElementById("at"), figs = [].slice.call(walk.querySelectorAll(".hang"));
    function centre(f) { return f.offsetLeft + f.offsetWidth / 2 - walk.clientWidth / 2; }
    function nearest() { var mid = walk.scrollLeft, best = 0, d = Infinity; figs.forEach(function (f, i) { var x = Math.abs(centre(f) - mid); if (x < d) { d = x; best = i; } }); return best; }
    function update() {
      var max = walk.scrollWidth - walk.clientWidth, w = walk.clientWidth / walk.scrollWidth * 100;
      pos.style.width = w + "%"; pos.style.left = (max ? walk.scrollLeft / max : 0) * (100 - w) + "%";
      atEl.textContent = !figs.length ? "" : figs[0].offsetLeft - walk.scrollLeft > walk.clientWidth * .7 ? figs.length + " photographs" : figs[nearest()].dataset.n + " / " + figs.length;
    }
    walk.addEventListener("scroll", update, { passive: true });
    walk.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      var max = walk.scrollWidth - walk.clientWidth;
      if ((e.deltaY < 0 && walk.scrollLeft <= 0) || (e.deltaY > 0 && walk.scrollLeft >= max - 1)) return;
      walk.scrollLeft += e.deltaY; e.preventDefault();
    }, { passive: false });
    passage.keys = function (d) { if (!figs.length) return; var n = nearest(), here = Math.abs(centre(figs[n]) - walk.scrollLeft) < 4, to = here ? n + d : (centre(figs[n]) > walk.scrollLeft) === (d > 0) ? n : n + d; walk.scrollTo({ left: to < 0 ? 0 : to >= figs.length ? walk.scrollWidth : centre(figs[to]), behavior: "smooth" }); };
    var m = /[?&]w=(\d+)/.exec(location.hash); if (m && figs[m[1] - 1]) walk.scrollLeft = figs[m[1] - 1].offsetLeft - walk.clientWidth * .09;
    update();
  }

  var sheet = { p: null, at: 0 };
  function contact(p) {
    var pause = p.groups.filter(function (g) { return g.type === "pause"; })[0];
    return '<main><section class="head"><div><span class="label">' + E("page.kicker", p.kicker) + "</span><h1>" + title(p, "page.") + "</h1></div><p>" + E("page.note", p.note) + "</p></section>" +
      (p.works.length ? '<ol class="sheet" id="work">' + p.works.map(function (w) { return ST.editing ? '<li><div class="cell"><button class="fr" data-i="' + w.i + '" aria-label="Hold ' + w.n + '">' + img(w) + "</button>" + cap(w, false) + "</div></li>" : '<li><button class="cell" data-i="' + w.i + '" aria-label="' + w.n + ", " + esc(w.title) + '"><span class="fr">' + img(w) + "</span>" + cap(w, false) + "</button></li>"; }).join("") + "</ol>" : empty(p)) +
      (pause ? '<section class="epi"><span class="label">' + E("pause.label", pause.label, ' data-k="' + pause.k + '"') + "</span><p>" + E("pause.text", pause.text, ' data-k="' + pause.k + '"') + "</p></section>" : "") + onward(p) + "</main>" + foot() +
      '<div class="held" id="held" role="dialog" aria-modal="true" aria-label="One work, held large"><div class="top"><button id="back">&larr; The sheet</button><span class="label" id="where"></span></div><div class="mid" id="mid"></div><div class="strip" id="strip">' +
      p.works.map(function (w) { return '<button data-i="' + w.i + '" aria-label="' + w.n + ", " + esc(w.title) + '"><img src="' + src(w) + '" alt=""></button>'; }).join("") + "</div></div>";
  }
  function sheetPut() {
    var p = sheet.p, G = p.groups, g = G[sheet.at], mid = document.getElementById("mid"), strip = document.getElementById("strip");
    mid.className = "mid " + (g.type === "pair" ? "two" : "one");
    mid.innerHTML = '<button class="zone prev" tabindex="-1" aria-label="Previous"></button><button class="zone next" tabindex="-1" aria-label="Next"></button>' + (g.type === "pause" ? '<p class="say"><span class="label">' + esc(g.label) + "</span>" + esc(g.text) + "</p>" : g.works.map(function (w) { return '<figure style="--r:' + w.r + '">' + img(w) + '<figcaption><p class="cap"><span class="n">' + w.n + "</span><span>" + esc(w.title) + '</span><span class="d">' + esc(w.date) + "</span></p>" + (g.note ? '<p class="aside">' + esc(g.note) + "</p>" : "") + "</figcaption></figure>"; }).join(""));
    var on = (g.works || []).map(function (w) { return w.i; });
    [].forEach.call(strip.children, function (b, i) { b.classList.toggle("on", on.indexOf(i) > -1); });
    document.getElementById("where").textContent = g.works ? g.works.map(function (w) { return w.n; }).join(" – ") + " / " + p.works.length : "";
  }
  function sheetShow(i, quick) { var G = sheet.p.groups; sheet.at = (i + G.length) % G.length; if (quick) return sheetPut(); document.getElementById("mid").classList.add("swap"); setTimeout(sheetPut, 240); }
  function sheetGroupOf(i) { var G = sheet.p.groups; for (var k = 0; k < G.length; k++) if (G[k].works && G[k].works.some(function (w) { return w.i === i; })) return k; return 0; }
  function sheetOpen(i) { sheetShow(sheetGroupOf(i), true); document.getElementById("held").classList.add("on"); root.dataset.lock = "on"; }
  function sheetClose() { var h = document.getElementById("held"); if (h) h.classList.remove("on"); delete root.dataset.lock; }

  function words(p) {
    var body = p.kind === "writing" ? '<p class="poem">' + E("page.text", p.text) + "</p>" + (p.image ? '<figure style="--r:' + p.image.r + '">' + img(p.image) + "<figcaption><p class=\"cap\"><span>" + esc(p.image.title) + "</span></p></figcaption></figure>" : "") : p.paras.map(function (t, i) { return "<p>" + E("page.para", t, ' data-k="' + i + '"') + "</p>"; }).join("");
    return '<main><section class="words"><div><span class="label">' + E("page.kicker", p.kicker || "") + "</span><h1>" + title(p, "page.") + '</h1></div><div class="body">' + body + "</div></section></main>" + foot();
  }

  /* ---- routing and drawing ---- */
  function current() { var id = STATIC ? STATIC.page : (location.hash.slice(1) || "/").split("?")[0].replace(/^\//, ""); return ST.doc.pages.filter(function (x) { return x.id === id; })[0] || null; }
  /* One page as plain html, for publishing: the same renderer, pointed at files instead of the hash. */
  function pageHtml(doc, pageId, base) {
    var keep = { doc: ST.doc, editing: ST.editing, base: ST.base }; ST.doc = doc; ST.editing = false; ST.base = base; ST.building = true;
    var p = doc.pages.filter(function (x) { return x.id === pageId; })[0], html;
    if (!p) html = bar("/") + fronts[doc.front]();
    else { var v = M.view(p), on = p.kind === "story" ? "/" : "/" + p.id; html = bar(on) + (p.kind !== "story" ? words(v) : p.arrangement === "book" ? bookPage(v) : p.arrangement === "passage" ? passage(v) : p.arrangement === "contact" ? contact(v) : held(v)); }
    ST.doc = keep.doc; ST.editing = keep.editing; ST.base = keep.base; ST.building = false; return html;
  }
  function applyLook() { var look = (ST.doc.theme && ST.doc.theme.look) || "quiet"; root.dataset.look = look; if (window.FolioTheme) window.FolioTheme.apply({ look: look, palette: "silk", type: "silk", space: "standard", read: "standard", mode: "system", accent: null }); }
  function draw(keepPlace) {
    if (ST.published && !M.published()) { app.innerHTML = '<main class="words" style="display:block"><span class="label">Published site</span><h1>Nothing is published yet.</h1><p style="max-width:34em;color:var(--ink-soft)">Open the editor and press Publish; the published copy then appears here, as a visitor would see it.</p><p><a href="site.html?edit#/">Back to the editor</a></p></main>'; return; }
    var y = window.scrollY, p = current(); sheetClose(); delete root.dataset.lock; ST.page = p ? p.id : null; applyLook();
    if (!p) { ST.view = "front"; root.dataset.view = "front"; app.innerHTML = bar("/") + fronts[ST.doc.front](); document.title = ST.doc.name; wireFront(); }
    else {
      var v = M.view(p); document.title = p.title + (p.titleEm ? " " + p.titleEm : "") + " · " + ST.doc.name;
      var on = p.kind === "story" ? "/" : "/" + p.id;
      if (p.kind !== "story") { ST.view = "words"; root.dataset.view = "words"; app.innerHTML = bar(on) + words(v); }
      else {
        ST.view = p.arrangement; root.dataset.view = ST.view;
        if (ST.view === "book") { if (!keepPlace) book.at = 0; app.innerHTML = bar(on) + bookPage(v); root.dataset.lock = "on"; bookShow(keepPlace ? book.at : Math.max(0, (parseInt((/[?&]s=(\d+)/.exec(location.hash) || [])[1], 10) || 1) - 1), true); }
        else if (ST.view === "passage") { var wasAt = keepPlace && document.getElementById("walk") ? document.getElementById("walk").scrollLeft : 0; app.innerHTML = bar(on) + passage(v); root.dataset.lock = "on"; passageWire(); if (wasAt) document.getElementById("walk").scrollLeft = wasAt; }
        else if (ST.view === "contact") { app.innerHTML = bar(on) + contact(v); sheet.p = v; var m = /[?&]open=(\d+)/.exec(location.hash); if (m && !keepPlace && v.works[m[1] - 1]) sheetOpen(m[1] - 1); }
        else app.innerHTML = bar(on) + held(v);
      }
    }
    if (ST.editing) { root.dataset.editing = "on"; } else delete root.dataset.editing;
    window.scrollTo(0, keepPlace ? y : 0);
    if (window.SiteEdit) window.SiteEdit.afterDraw();
  }
  function wireFront() {
    var held = document.getElementById("ledgerheld"); if (!held) return;
    var items = listed();
    app.querySelectorAll(".ledger a[data-i]").forEach(function (a) { a.addEventListener("mouseenter", function () { held.innerHTML = ledgerPick(items[+a.dataset.i]); }); a.addEventListener("focus", function () { held.innerHTML = ledgerPick(items[+a.dataset.i]); }); });
  }
  app.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest("[data-act]")) return;
    if (ST.view === "book") { var z = t.closest(".zone"); if (z) return bookGo(z.classList.contains("next") ? 1 : -1); if (t.id === "prev") return bookGo(-1); if (t.id === "next") return bookGo(1); }
    if (ST.view === "contact") {
      var c = t.closest(".cell[data-i], .cell .fr[data-i]"); if (c) return sheetOpen(+c.dataset.i);
      var s = t.closest("#strip button"); if (s) return sheetShow(sheetGroupOf(+s.dataset.i));
      var hz = t.closest("#mid .zone"); if (hz) return sheetShow(sheet.at + (hz.classList.contains("next") ? 1 : -1));
      if (t.id === "back") return sheetClose();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.target.isContentEditable || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (ST.view === "book" && d) { bookGo(d); e.preventDefault(); }
    if (ST.view === "passage" && d && passage.keys) { passage.keys(d); e.preventDefault(); }
    if (ST.view === "contact" && document.getElementById("held") && document.getElementById("held").classList.contains("on")) { if (e.key === "Escape") sheetClose(); if (d) sheetShow(sheet.at + d); }
  });
  var x0 = null;
  app.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  app.addEventListener("touchend", function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) < 40 || ST.editing) return; if (ST.view === "book") bookGo(dx < 0 ? 1 : -1); if (ST.view === "contact" && document.getElementById("held").classList.contains("on")) sheetShow(sheet.at + (dx < 0 ? 1 : -1)); });
  window.addEventListener("hashchange", function () { draw(); });
  window.matchMedia("(max-width: 700px)").addEventListener("change", function () { if (ST.view === "book") draw(true); });
  if (/[?&]preview/.test(location.search) || ST.published || STATIC) root.dataset.preview = "on";
  window.SiteRender = { draw: draw, current: current, href: href, stories: stories, pageHtml: pageHtml };
  if (STATIC) { Object.keys(STATIC.lib || {}).forEach(function (k) { var w = STATIC.lib[k]; M.LIB[k] = Object.assign({}, w, { src: STATIC.base + "assets/img/" + w.file }); }); draw(); }
  else M.ready().then(function () { /* wait for the editor's script too: in some browsers the library answers before it has loaded */ function boot() { draw(); if (window.SiteEdit) window.SiteEdit.start(); } if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot(); });
})();
