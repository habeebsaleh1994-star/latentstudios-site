/* Atelier: each project with its process beside its outcome, and room for the studio's own voice.
   Only what is specific to Atelier is here; the engine does the rest. */
(function () {
  var L = window.LatentStudio, EN = window.LatentEngine;

  function render(c) {
    var S = c.S, M = c.M, esc = c.esc, editing = c.editing, last = M.projects.length - 1;
    function ce(attrs, text, tag, cls, ph, multiline) { return "<" + tag + (cls ? ' class="' + cls + '"' : "") + ' contenteditable="plaintext-only" spellcheck="false" ' + attrs + (ph ? ' data-ph="' + ph + '"' : "") + (multiline ? " data-multiline" : "") + ">" + esc(text) + "</" + tag + ">"; }
    function num(n) { return ("0" + (n + 1)).slice(-2); }

    function tools(p, i) {
      return '<div class="tb ptb" role="toolbar" aria-label="Edit this project">' +
        '<button type="button" data-act="a-add" data-p="' + p.id + '" data-g="o">Add outcome</button>' +
        '<button type="button" data-act="a-add" data-p="' + p.id + '" data-g="p">Add process step</button>' +
        '<button type="button" data-act="a-compare" data-p="' + p.id + '">' + (p.compare ? "Comparison on" : "Comparison off") + "</button>" +
        '<button type="button" data-act="a-up" data-p="' + p.id + '"' + (i === 0 ? " disabled" : "") + ' aria-label="Move earlier">&uarr;</button>' +
        '<button type="button" data-act="a-down" data-p="' + p.id + '"' + (i === last ? " disabled" : "") + ' aria-label="Move later">&darr;</button>' +
        '<button type="button" data-act="a-del" data-p="' + p.id + '">Delete</button></div>';
    }
    function imgTools(p, g, i, n) {
      var a = 'data-p="' + p.id + '" data-g="' + g + '" data-i="' + i + '"';
      return '<div class="tb" role="toolbar" aria-label="Edit this image"><button type="button" data-act="a-img-replace" ' + a + ">Replace</button>" +
        '<button type="button" data-act="a-img-up" ' + a + (i === 0 ? " disabled" : "") + ' aria-label="Move earlier">&uarr;</button>' +
        '<button type="button" data-act="a-img-down" ' + a + (i === n - 1 ? " disabled" : "") + ' aria-label="Move later">&darr;</button>' +
        '<button type="button" data-act="a-img-del" ' + a + ">Remove</button></div>";
    }
    function fig(p, g, i, im, n, numbered) {
      var a = 'data-p="' + p.id + '" data-g="' + g + '" data-i="' + i + '"';
      return '<figure class="fig"><div class="frame"><img src="' + im.src + '" width="' + im.w + '" height="' + im.h + '" alt="' + esc(im.alt) + '" loading="lazy">' + (editing ? imgTools(p, g, i, n) : "") + "</div><figcaption>" +
        (numbered ? '<span class="n">' + num(i) + "</span>" : "<span></span>") +
        "<span>" + (editing ? ce(a + ' data-k="title"', im.title, "b", "", "Label") + ". " + ce(a + ' data-k="caption"', im.caption, "span", "", "A line about it") : (im.title ? "<b>" + esc(im.title) + "</b>" + (im.caption ? ". " + esc(im.caption) : "") : esc(im.caption))) + "</span></figcaption></figure>";
    }
    function compare(p) {
      var o = p.outcome[0], s = p.process[0]; if (!p.compare || !o || !s) return "";
      return '<div class="cmp"><div class="col-h"><span>Process, set against the outcome</span><span>Drag, or use the arrow keys</span></div>' +
        '<div class="compare" style="--cr:' + (o.w / o.h).toFixed(3) + '"><img src="' + o.src + '" alt="' + esc(o.alt) + '" loading="lazy"><img class="over" src="' + s.src + '" alt="' + esc(s.alt) + '" loading="lazy">' +
        '<input type="range" min="0" max="100" value="50" aria-label="Compare the first process step with the outcome"><span class="knob"></span><span class="tag l">' + esc(s.title || "Process") + '</span><span class="tag r">' + esc(o.title || "Outcome") + "</span></div></div>";
    }
    function project(p, i) {
      var a = 'data-p="' + p.id + '"';
      var meta = editing ? ce(a + ' data-k="discipline"', p.discipline, "span", "", "Kind") + " · " + ce(a + ' data-k="client"', p.client, "span", "", "Client") + " · " + ce(a + ' data-k="year"', p.year, "span", "", "Year") : [p.discipline, p.client, p.year].filter(Boolean).map(esc).join(" · ");
      var facts = editing ? ce(a + ' data-k="facts"', p.facts.join("\n"), "div", "facts-edit", "Role: …  (one fact per line)", true)
        : (p.facts.length ? '<dl class="facts">' + p.facts.map(function (t) { var k = t.indexOf(":"); return k > 0 ? "<dt>" + esc(t.slice(0, k)) + "</dt><dd>" + esc(t.slice(k + 1).trim()) + "</dd>" : "<dt></dt><dd>" + esc(t) + "</dd>"; }).join("") + "</dl>" : "");
      var steps = p.process.map(function (im, k) { return fig(p, "p", k, im, p.process.length, true); }).join("");
      var lead = p.outcome.length ? fig(p, "o", 0, p.outcome[0], p.outcome.length, false) : "";
      var more = p.outcome.slice(1).map(function (im, k) { return fig(p, "o", k + 1, im, p.outcome.length, false); }).join("");
      return '<article class="proj arrive" id="' + p.id + '" aria-labelledby="h-' + p.id + '">' + (editing ? tools(p, i) : "") +
        '<div class="ph"><div><span class="label">' + meta + "</span>" + (editing ? ce(a + ' data-k="title" id="h-' + p.id + '"', p.title, "h2", "", "Project title") : '<h2 id="h-' + p.id + '">' + esc(p.title) + "</h2>") + "</div>" +
        "<div>" + (editing ? ce(a + ' data-k="summary"', p.summary, "p", "sum", "What the project was") : (p.summary ? '<p class="sum">' + esc(p.summary) + "</p>" : "")) + facts + "</div></div>" +
        '<div class="cols"><div><div class="col-h"><span>Process</span><span>' + p.process.length + ' steps</span></div><div class="steps">' + steps + "</div></div>" +
        '<div class="col-out"><div class="col-h"><span>Outcome</span><span>' + p.outcome.length + '</span></div><div class="outcome">' + lead + "</div></div></div>" + (more ? '<div class="more">' + more + "</div>" : "") + compare(p) +
        (editing && i < last ? '<div class="addrow tight"><button type="button" data-act="a-new" data-after="' + i + '" aria-label="Add a project here">+</button></div>' : "") + "</article>";
    }

    var kinds = []; M.projects.forEach(function (p) { if (p.discipline && kinds.indexOf(p.discipline) < 0) kinds.push(p.discipline); });
    var projects = M.projects.map(project).join("") + (editing ? '<div class="addrow end"><button type="button" data-act="a-new" data-after="' + last + '">New project</button></div>' : "");

    var about = M.studio.about.map(function (t, i) { return editing ? ce('data-s="about" data-i="' + i + '"', t, "p", "", "Write about the studio") : "<p>" + esc(t) + "</p>"; }).join("");
    var prin = M.studio.principles.map(function (t, i) { return "<li>" + (editing ? ce('data-s="principle" data-i="' + i + '"', t, "span", "", "A principle") : esc(t)) + "</li>"; }).join("");
    var voice = '<section class="voice studio" id="studio"><div class="ph"><div><span class="label">The studio</span><h2>' + esc(S.aboutTitle) + '</h2></div><div class="intro">' + about + (editing ? '<p><button type="button" class="link-btn" data-act="a-para-add">+ Add a paragraph</button></p>' : "") + "</div></div>" +
      '<ol class="principles">' + prin + "</ol>" + (editing ? '<p style="margin-top:18px"><button type="button" class="link-btn" data-act="a-prin-add">+ Add a principle</button></p>' : "") + "</section>";

    return '<header class="bar"><a class="name" href="#top">' + esc(S.name) + '</a><nav aria-label="Primary"><a href="#projects">Projects</a><a href="#studio">Studio</a><a href="#contact">Contact</a></nav></header>' +
      '<main id="top"><section class="card" aria-labelledby="title"><div><div class="label">' + esc(S.kicker) + '</div><h1 id="title">' + esc(S.title) + " <em>" + esc(S.titleEm) + '</em></h1></div><p class="note">' + esc(S.note) + "</p></section>" +
      '<div class="studio"><div class="kinds">' + kinds.map(function (k) { return "<span>" + esc(k) + "</span>"; }).join("") + '</div></div>' +
      '<div class="studio" id="projects">' + projects + "</div>" + voice + "</main>" +
      '<section class="about" id="about" style="margin-top:0"><div class="foot" id="contact" style="margin-top:0"><span class="label">' + esc(S.contact) + '</span><a class="mark" href="#top" aria-label="Made with Latent Wall">l.</a></div></section>';
  }

  /* the comparison: drag anywhere on it, or use the arrow keys on the hidden slider */
  function bindCompare() {
    document.querySelectorAll(".compare").forEach(function (box) {
      var input = box.querySelector("input"), set = function (v) { v = Math.max(0, Math.min(100, v)); box.style.setProperty("--cut", v + "%"); input.value = v; };
      input.addEventListener("input", function () { set(+input.value); });
      var down = false, at = function (e) { var r = box.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
      box.addEventListener("pointerdown", function (e) { down = true; try { box.setPointerCapture(e.pointerId); } catch (x) {} at(e); });
      box.addEventListener("pointermove", function (e) { if (down) at(e); });
      box.addEventListener("pointerup", function () { down = false; });
      box.addEventListener("pointercancel", function () { down = false; });
    });
  }

  function pid(M, id) { for (var i = 0; i < M.projects.length; i++) if (M.projects[i].id === id) return i; return -1; }
  function grp(p, g) { return g === "p" ? p.process : p.outcome; }

  EN.run({
    name: "atelier",
    accepts: function (d) { return d.room === "atelier"; },
    page: "projects",
    options: [
      { key: "side", title: "Outcome", def: "right", choices: [["right", "On the right"], ["left", "On the left"]] },
      { key: "steps", title: "Process", def: "list", choices: [["list", "As a list"], ["strip", "As a filmstrip"]] }
    ],
    seed: "doc/common-form.studio.json",
    assets: "doc/assets.json",
    sections: ["look", "options", "words", "palette", "mode", "accent", "type", "mount", "space", "motion"],
    words: [{ key: "name", label: "Your name" }, { key: "title", label: "Title, first part" }, { key: "titleEm", label: "Title, italic part" }, { key: "note", label: "Introduction", kind: "area" }],
    /* the studio's words live in the editable model, so undo covers them */
    toContent: function (doc, resolve) { var c = L.toAtelierContent(doc, resolve); c.studio = { about: c.site.about, principles: c.site.principles }; return c; },
    fromContent: function (doc, c) { var site = Object.assign({}, c.site, { about: c.studio.about, principles: c.studio.principles }); return L.fromAtelierContent(doc, { site: site, projects: c.projects }); },
    render: render,
    afterRender: bindCompare,
    count: function (M) { return M.projects.reduce(function (n, p) { return n + p.outcome.length + p.process.length; }, 0); },
    onWord: function (k, v, c) {
      if (k === "title" || k === "titleEm") document.getElementById("title").innerHTML = c.esc(c.S.title) + " <em>" + c.esc(c.S.titleEm) + "</em>";
      else document.querySelector({ name: ".bar .name", note: ".card .note" }[k]).textContent = v;
    },
    setText: function (M, d, v) {
      if (d.s) { var list = d.s === "about" ? M.studio.about : M.studio.principles; if (v === "") list.splice(+d.i, 1); else list[+d.i] = v; return; }
      var i = pid(M, d.p); if (i < 0) return; var p = M.projects[i];
      if (d.g) { var im = grp(p, d.g)[+d.i]; if (im) im[d.k] = v; }
      else if (d.k === "facts") p.facts = v.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
      else p[d.k] = v;
    },
    afterText: function (M, d, x) { if (d.s && d.s !== undefined) x.draw(); },
    act: function (a, t, x) {
      var M = x.M, i = pid(M, t.dataset.p), p = M.projects[i];
      if (a === "a-new") {
        x.snap(); var at = +t.dataset.after + 1;
        M.projects.splice(at, 0, { id: "p" + Date.now().toString(36), title: "Untitled", discipline: "Identity", client: "", year: String(new Date().getFullYear()), summary: "", facts: [], outcome: [], process: [], compare: false });
        x.draw(); var n = document.querySelectorAll(".proj")[at]; n && n.scrollIntoView({ block: "start" });
      } else if (a === "a-up" || a === "a-down") { var j = a === "a-up" ? i - 1 : i + 1; if (j < 0 || j >= M.projects.length) return; x.snap(); var tmp = M.projects[i]; M.projects[i] = M.projects[j]; M.projects[j] = tmp; x.draw(); }
      else if (a === "a-del") { x.snap(); M.projects.splice(i, 1); x.draw(); x.toast("Deleted. Undo brings it back."); }
      else if (a === "a-compare") { if (!p.outcome.length || !p.process.length) return x.toast("A comparison needs at least one outcome image and one process step."); x.snap(); p.compare = !p.compare; x.draw(); }
      else if (a === "a-add") x.pick({ p: p.id, g: t.dataset.g, add: true }, true);
      else if (a === "a-img-replace") x.pick({ p: p.id, g: t.dataset.g, i: +t.dataset.i, replace: true }, false);
      else if (a === "a-img-up" || a === "a-img-down") { var arr = grp(p, t.dataset.g), k = +t.dataset.i, m = a === "a-img-up" ? k - 1 : k + 1; if (m < 0 || m >= arr.length) return; x.snap(); var s = arr[k]; arr[k] = arr[m]; arr[m] = s; x.draw(); }
      else if (a === "a-img-del") { x.snap(); grp(p, t.dataset.g).splice(+t.dataset.i, 1); if (!p.process.length || !p.outcome.length) p.compare = false; x.draw(); }
      else if (a === "a-para-add") { x.snap(); M.studio.about.push(""); x.draw(); var ps = document.querySelectorAll('[data-s="about"]'); ps[ps.length - 1].focus(); }
      else if (a === "a-prin-add") { x.snap(); M.studio.principles.push(""); x.draw(); var qs = document.querySelectorAll('[data-s="principle"]'); qs[qs.length - 1].focus(); }
    },
    onImages: function (M, meta, ims) {
      var p = M.projects[pid(M, meta.p)]; if (!p) return; var arr = grp(p, meta.g);
      function make(im, prev) { return { assetId: im.assetId, src: im.src, w: im.w, h: im.h, alt: prev ? prev.alt : "", title: prev ? prev.title : "Untitled", caption: prev ? prev.caption : "" }; }
      if (meta.replace) arr[meta.i] = make(ims[0], arr[meta.i]); else ims.forEach(function (im) { arr.push(make(im, null)); });
    }
  });
})();
