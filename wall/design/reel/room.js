/* Reel: a screen in the dark. Each film at its own ratio, with its stills as frames and its credits as small print.
   Only what is specific to Reel is here; the engine does the rest. */
(function () {
  var L = window.LatentStudio, EN = window.LatentEngine, EL = window.LatentEntitlements;
  var RATIOS = ["2.39:1", "2.00:1", "1.85:1", "16:9", "4:3", "1:1"];
  var current = null;

  function render(c) {
    var S = c.S, M = c.M, esc = c.esc, editing = c.editing, last = M.films.length - 1;
    function ce(attrs, text, tag, cls, ph, multiline) { return "<" + tag + (cls ? ' class="' + cls + '"' : "") + ' contenteditable="plaintext-only" spellcheck="false" ' + attrs + (ph ? ' data-ph="' + ph + '"' : "") + (multiline ? " data-multiline" : "") + ">" + esc(text) + "</" + tag + ">"; }
    function tools(f, i) {
      var hasVideo = !!f.video;
      return '<div class="tb ptb" role="toolbar" aria-label="Edit this film">' +
        '<button type="button" data-act="f-poster" data-f="' + f.id + '">' + (f.poster ? "Replace poster" : "Add poster") + "</button>" +
        '<button type="button" data-act="f-video" data-f="' + f.id + '">' + (hasVideo ? "Replace film" : "Add film") + "</button>" +
        (hasVideo ? '<button type="button" data-act="f-video-del" data-f="' + f.id + '">Remove film</button>' : "") +
        '<button type="button" data-act="f-ratio" data-f="' + f.id + '">' + esc(f.ratio || "16:9") + " &rsaquo;</button>" +
        '<button type="button" data-act="f-still" data-f="' + f.id + '">Add stills</button>' +
        '<button type="button" data-act="f-up" data-f="' + f.id + '"' + (i === 0 ? " disabled" : "") + ' aria-label="Move earlier">&uarr;</button>' +
        '<button type="button" data-act="f-down" data-f="' + f.id + '"' + (i === last ? " disabled" : "") + ' aria-label="Move later">&darr;</button>' +
        '<button type="button" data-act="f-del" data-f="' + f.id + '">Delete</button></div>';
    }
    function screen(f) {
      var inner = f.poster ? '<img src="' + f.poster.src + '" width="' + f.poster.w + '" height="' + f.poster.h + '" alt="' + esc(f.poster.alt || f.title) + '" loading="lazy">' : '<div class="none">' + (editing ? "Add a poster" : "") + "</div>";
      if (f.video) inner += '<button type="button" class="play" data-play="' + f.id + '" aria-label="Play ' + esc(f.title) + '"><i></i></button>';
      else if (f.link) inner += '<a class="watch" href="' + esc(f.link) + '" target="_blank" rel="noopener">Watch</a>';
      return '<div class="screen" data-screen="' + f.id + '">' + inner + "</div>";
    }
    function film(f, i) {
      var meta = editing
        ? ce('data-f="' + f.id + '" data-k="form"', f.form, "span", "", "Form") + " · " + ce('data-f="' + f.id + '" data-k="year"', f.year, "span", "", "Year") + " · " + ce('data-f="' + f.id + '" data-k="runtime"', f.runtime, "span", "", "Length") + " · " + esc(f.ratio)
        : [f.form, f.year, f.runtime, f.ratio].filter(Boolean).map(esc).join(" · ");
      var credits = editing ? ce('data-f="' + f.id + '" data-k="credits"', f.credits.join("\n"), "div", "credits-edit", "Credits, one per line", true) : (f.credits.length ? '<ul class="credits">' + f.credits.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "");
      var stills = f.stills.map(function (s, k) { return '<figure><img src="' + s.src + '" width="' + s.w + '" height="' + s.h + '" alt="' + esc(s.alt || f.title) + '" loading="lazy" data-still="' + f.id + ":" + k + '">' + (editing ? '<button type="button" class="rm" data-act="f-still-del" data-f="' + f.id + '" data-i="' + k + '">Remove</button>' : "") + "</figure>"; }).join("");
      return '<article class="film arrive" id="' + f.id + '" style="--r:' + L.ratioNumber(f.ratio).toFixed(3) + '" aria-labelledby="h-' + f.id + '">' +
        (editing ? tools(f, i) : "") + screen(f) +
        '<div class="info"><div><span class="label">' + meta + "</span>" + (editing ? ce('data-f="' + f.id + '" data-k="title" id="h-' + f.id + '"', f.title, "h2", "", "Title") : '<h2 id="h-' + f.id + '">' + esc(f.title) + "</h2>") + "</div>" +
        "<div>" + (editing ? ce('data-f="' + f.id + '" data-k="synopsis"', f.synopsis, "p", "syn", "A line or two about the film") + '<p class="syn">Watch link: ' + ce('data-f="' + f.id + '" data-k="link"', f.link, "span", "", "Where it can be watched") + "</p>" : (f.synopsis ? '<p class="syn">' + esc(f.synopsis) + "</p>" : "")) + credits + "</div></div>" +
        (stills || editing ? '<div class="stills">' + stills + "</div>" : "") +
        (editing && i < last ? '<div class="addrow tight"><button type="button" data-act="f-new" data-after="' + i + '" aria-label="Add a film here">+</button></div>' : "") + "</article>";
    }
    var films = M.films.map(film).join("") + (editing ? '<div class="addrow end"><button type="button" data-act="f-new" data-after="' + last + '">New film</button></div>' : "");
    return '<header class="bar"><a class="name" href="#top">' + esc(S.name) + '</a><nav aria-label="Primary"><a href="#films">Films</a><a href="#about">About</a><a href="#contact">Contact</a></nav></header>' +
      '<main id="top"><section class="card" aria-labelledby="title"><div><div class="label">' + esc(S.kicker) + '</div><h1 id="title">' + esc(S.title) + " <em>" + esc(S.titleEm) + '</em></h1></div><p class="note">' + esc(S.note) + "</p></section>" +
      '<div class="reel" id="films">' + films + "</div></main>" +
      '<section class="about" id="about"><div class="about-in"><h2>' + esc(S.aboutTitle) + "</h2><div>" + S.about.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + '</div></div><div class="foot" id="contact"><span class="label">' + esc(S.contact) + '</span><a class="mark" href="#top" aria-label="Made with Latent Wall">l.</a></div></section>';
  }

  /* play a film where it stands; look at a still large */
  document.addEventListener("click", function (e) {
    if (!current) return;
    var p = e.target.closest("[data-play]");
    if (p) {
      var f = current.films.filter(function (x) { return x.id === p.dataset.play; })[0]; if (!f || !f.video) return;
      var box = p.closest(".screen"); box.innerHTML = '<video src="' + f.video.src + '" controls autoplay playsinline' + (f.poster ? ' poster="' + f.poster.src + '"' : "") + "></video>";
      var v = box.querySelector("video"); v.play && v.play().catch(function () {});
      return;
    }
    var s = e.target.closest("[data-still]"); if (!s || document.documentElement.dataset.editing) return;
    var parts = s.dataset.still.split(":"), film = current.films.filter(function (x) { return x.id === parts[0]; })[0]; if (!film) return;
    window.LatentViewer.open(film.stills.map(function (st) { return { src: st.src, alt: st.alt, title: st.caption || film.title, meta: film.title }; }), +parts[1]);
  });

  function byId(M, id) { for (var i = 0; i < M.films.length; i++) if (M.films[i].id === id) return i; return -1; }
  function still(im, caption) { return { assetId: im.assetId, src: im.src, w: im.w, h: im.h, alt: "", caption: caption || "" }; }

  EN.run({
    name: "reel",
    accepts: function (d) { return d.room === "reel"; },
    page: "films",
    options: [
      { key: "stills", title: "Stills", def: "row", choices: [["row", "In a row"], ["grid", "As a grid"]] },
      { key: "info", title: "Words", def: "beside", choices: [["beside", "Beside"], ["below", "Below, centred"]] }
    ],
    seed: "doc/ivo-sen.studio.json",
    assets: "doc/assets.json",
    sections: ["look", "options", "words", "palette", "mode", "accent", "type", "space", "motion"],
    words: [{ key: "name", label: "Your name" }, { key: "title", label: "Title, first part" }, { key: "titleEm", label: "Title, italic part" }, { key: "note", label: "Introduction", kind: "area" }],
    toContent: function (doc, resolve) { var c = L.toReelContent(doc, resolve); current = c; return c; },
    fromContent: function (doc, c) { return L.fromReelContent(doc, c); },
    render: function (c) { current = c.M; return render(c); },
    count: function (M) { return M.films.reduce(function (n, f) { return n + (f.poster ? 1 : 0) + f.stills.length; }, 0); },
    onWord: function (k, v, c) {
      if (k === "title" || k === "titleEm") document.getElementById("title").innerHTML = c.esc(c.S.title) + " <em>" + c.esc(c.S.titleEm) + "</em>";
      else document.querySelector({ name: ".bar .name", note: ".card .note" }[k]).textContent = v;
    },
    setText: function (M, d, v) {
      var i = byId(M, d.f); if (i < 0) return; var f = M.films[i];
      if (d.k === "credits") f.credits = v.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
      else f[d.k] = v;
    },
    act: function (a, t, x) {
      var M = x.M, i = byId(M, t.dataset.f), f = M.films[i];
      if (a === "f-new") {
        x.snap(); var at = +t.dataset.after + 1;
        M.films.splice(at, 0, { id: "f" + Date.now().toString(36), title: "Untitled", form: "Short film", year: String(new Date().getFullYear()), runtime: "", ratio: "16:9", synopsis: "", credits: [], link: "", poster: null, video: null, stills: [] });
        x.draw(); var n = document.querySelectorAll(".film")[at]; n && n.scrollIntoView({ block: "start" });
      } else if (a === "f-up" || a === "f-down") { var j = a === "f-up" ? i - 1 : i + 1; if (j < 0 || j >= M.films.length) return; x.snap(); var tmp = M.films[i]; M.films[i] = M.films[j]; M.films[j] = tmp; x.draw(); }
      else if (a === "f-del") { x.snap(); M.films.splice(i, 1); x.draw(); x.toast("Deleted. Undo brings it back."); }
      else if (a === "f-ratio") { x.snap(); f.ratio = RATIOS[(RATIOS.indexOf(f.ratio) + 1) % RATIOS.length]; x.draw(); }
      else if (a === "f-poster") x.pick({ film: f.id, role: "poster", replace: true }, false);
      else if (a === "f-still") x.pick({ film: f.id, role: "still" }, true);
      else if (a === "f-still-del") { x.snap(); f.stills.splice(+t.dataset.i, 1); x.draw(); }
      else if (a === "f-video") { if (!EL.limit("video")) return x.toast("Films can be added on the " + EL.PLANS.full.name + " plan. You can still add a link to a film hosted elsewhere."); x.pick({ film: f.id, video: true }, false); }
      else if (a === "f-video-del") { x.snap(); f.video = null; x.draw(); }
    },
    onImages: function (M, meta, ims) {
      var f = M.films[byId(M, meta.film)]; if (!f) return;
      if (meta.role === "poster") { var im = ims[0]; f.poster = { assetId: im.assetId, src: im.src, w: im.w, h: im.h, alt: f.poster ? f.poster.alt : "", caption: "Poster" }; }
      else ims.forEach(function (im) { f.stills.push(still(im)); });
    },
    onVideo: function (M, meta, v) { var f = M.films[byId(M, meta.film)]; if (f) f.video = { assetId: v.assetId, src: v.src }; }
  });
})();
