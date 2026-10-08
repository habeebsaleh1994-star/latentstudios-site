/* The editor: the dock, Customise in three tabs (this site, this page, the look), the library, publishing, history, saving. */
(function () {
  var M = window.SiteModel, ST = window.SiteState, R = window.SiteRender, T = window.FolioTheme, esc = M.esc, root = document.documentElement;
  var panel = document.getElementById("panel"), lib = document.getElementById("lib"), pubsheet = document.getElementById("pubsheet");
  var past = [], future = [], saved = true, toastT, tab = "site", mode = "edit";
  function doc() { return ST.doc; }
  function page() { return R.current(); }
  function story() { var p = page(); return p && p.kind === "story" ? p : null; }
  function title(p) { return p.title + (p.titleEm ? " " + p.titleEm : ""); }
  function photos(d) { var n = 0; d.pages.forEach(function (p) { if (p.kind === "story") n += M.count(p); }); return n; }

  /* ---- history and saving ---- */
  function snap() { var s = M.stored(); if (s && (s.rev || 0) > (doc().rev || 0)) { ST.doc = s; past = []; future = []; } past.push(JSON.stringify(doc())); if (past.length > 60) past.shift(); future = []; }
  function commit(keep) { saved = M.save(doc()); R.draw(keep !== false); meter(); if (panel.classList.contains("open")) renderPanel(); }
  function undo() { if (!past.length) return; future.push(JSON.stringify(doc())); ST.doc = JSON.parse(past.pop()); commit(); }
  function redo() { if (!future.length) return; past.push(JSON.stringify(doc())); ST.doc = JSON.parse(future.pop()); commit(); }
  function toast(s) { var n = document.querySelector(".tbnote"); if (!n) { n = document.createElement("div"); n.className = "tbnote"; document.body.appendChild(n); } n.textContent = s; clearTimeout(toastT); toastT = setTimeout(function () { n.remove(); }, 2800); }
  function meter() {
    var d = doc(), n = photos(d), pub = M.published(), changed = pub && JSON.stringify(pub.doc) !== JSON.stringify(d);
    document.getElementById("meter").innerHTML = ST.editing ? "<b>" + n + "</b> photographs <span class=\"more\">· <b>" + d.pages.length + "</b> pages" + (d.plan === "full" ? " · Full" : " · Free, up to 20") + (saved ? ' <span class="saved">· Saved on this device</span>' : "") + (changed ? " · Changed since publishing" : "") + "</span>" : "";
    document.getElementById("undo").hidden = !ST.editing; document.getElementById("redo").hidden = !ST.editing;
    document.getElementById("undo").disabled = !past.length; document.getElementById("redo").disabled = !future.length;
  }

  /* ---- pages ---- */
  function id() { return "p" + Date.now().toString(36); }
  function addPage(kind, open) {
    var d = doc(), p;
    if (kind === "story") p = { id: id(), kind: "story", title: "New story", titleEm: "", kicker: "", note: "", arrangement: "held", inNav: true, items: [] };
    else if (kind === "writing") p = { id: id(), kind: "writing", title: "A new note", titleEm: "", kicker: "", image: "", inNav: true, text: "Write here." };
    else if (kind === "about") p = { id: "about", kind: "about", title: "About", inNav: true, paras: ["A few lines about you and the work."] };
    else p = { id: "contact", kind: "contact", title: "Contact", inNav: true, paras: ["How to reach you."] };
    snap();
    var last = -1; d.pages.forEach(function (x, i) { if (x.kind === kind) last = i; });
    if (kind === "story" || kind === "writing") d.pages.splice(last < 0 ? d.pages.filter(function (x) { return x.kind === "story"; }).length : last + 1, 0, p); else d.pages.push(p);
    if (open !== false) { tab = "page"; location.hash = "/" + p.id; } commit(); return p;
  }
  function movePage(pid, dir) { var d = doc(), i = d.pages.map(function (p) { return p.id; }).indexOf(pid), j = i + dir; if (i < 0 || j < 0 || j >= d.pages.length) return; snap(); var x = d.pages[i]; d.pages[i] = d.pages[j]; d.pages[j] = x; commit(); }
  function removePage(pid) { var d = doc(); if (d.pages.length < 2) return toast("A site needs at least one page."); snap(); d.pages = d.pages.filter(function (p) { return p.id !== pid; }); if (ST.page === pid) { tab = "site"; location.hash = "/"; } commit(); toast("Page removed. Undo brings it back."); }

  /* ---- works within a story ---- */
  function arrangeOptions(p, k) {
    var it = p.items[k], prev = p.items[k - 1], nx = p.items[k + 1], o = [], port = M.LIB[it.f] && M.LIB[it.f].r < 1;
    function plain(x) { return x && !x.pause && x.arrange !== "with-next" && x.arrange !== "margin-note"; }
    var paired = it.arrange === "with-next" && nx && !nx.pause, pairedPrev = prev && !prev.pause && prev.arrange === "with-next";
    o.push({ key: "alone", d: "single", t: "Large and alone", s: "Held still, with a caption", cur: !paired && !pairedPrev && it.arrange !== "margin-note" && !it.full });
    if (!port && plain(nx) && !pairedPrev) o.push({ key: "with-next", d: "pair", t: "Pair with the next one", s: "Side by side", cur: paired });
    if (!port && plain(prev) && !paired) o.push({ key: "with-prev", d: "pair-prev", t: "Pair with the one before", s: "Side by side", cur: pairedPrev });
    if (port) o.push({ key: "margin-note", d: "split", t: "Portrait with a note", s: "A margin note beside it", cur: it.arrange === "margin-note" });
    if (!paired && !pairedPrev) o.push({ key: "full", d: "single", t: "Full", s: "Across both pages in a Book", cur: !!it.full });
    o.push({ key: "pause-after", d: "single", t: "A pause after it", s: "A few words before the next" });
    return o;
  }
  function arrange(k, key) {
    var p = story(); if (!p) return; var it = p.items[k], prev = p.items[k - 1]; snap();
    if (key.slice(0, 3) === "to:") { var dest = key.slice(3) === "new" ? addPage("story", false) : doc().pages.filter(function (x) { return x.id === key.slice(3); })[0]; p.items.splice(k, 1); if (prev && prev.arrange === "with-next" && (!p.items[k] || p.items[k].pause)) prev.arrange = "alone"; dest.items.push({ f: it.f, arrange: "alone", note: "", full: false }); commit(); return toast("Moved to " + title(dest) + "."); }
    if (key === "pause-after") { p.items.splice(k + 1, 0, { pause: true, label: "From the story", text: "A few words here." }); if (it.arrange === "with-next") it.arrange = "alone"; }
    else if (key === "with-prev") { prev.arrange = "with-next"; it.arrange = "alone"; it.full = false; }
    else if (key === "full") { it.full = !it.full; it.arrange = "alone"; if (prev && prev.arrange === "with-next") prev.arrange = "alone"; }
    else { it.arrange = key; it.full = false; if (prev && prev.arrange === "with-next") prev.arrange = "alone"; }
    ST.arrOpen = null; commit();
  }
  function moveItem(k, dir) { var p = story(), j = k + dir; if (!p || j < 0 || j >= p.items.length) return; snap(); var x = p.items[k]; p.items[k] = p.items[j]; p.items[j] = x; commit(); }
  function removeItem(k) { var p = story(); if (!p) return; snap(); var prev = p.items[k - 1]; p.items.splice(k, 1); if (prev && prev.arrange === "with-next" && (!p.items[k] || p.items[k].pause)) prev.arrange = "alone"; commit(); toast("Removed from this story. Undo brings it back."); }
  function addItems(pid, afterK, files) { var p = doc().pages.filter(function (x) { return x.id === pid; })[0]; if (!p) return; snap(); var at = afterK + 1; files.forEach(function (f, i) { p.items.splice(at + i, 0, { f: f, arrange: "alone", note: "", full: false }); }); commit(); toast(files.length + (files.length === 1 ? " photograph added." : " photographs added.")); }

  /* ---- words ---- */
  function setWord(field, v, k) {
    var d = doc(), p = page(), s = field.split("."); v = v.replace(/\s+$/, "");
    if (s[0] === "site") d[s[1]] = v;
    else if (s[0] === "page" && p) { if (s[1] === "para") p.paras[+k] = v; else p[s[1]] = v; }
    else if ((s[0] === "item" || s[0] === "pause") && p) p.items[+k][s[1]] = v;
    saved = M.save(d); meter();
  }

  /* ---- Customise: three tabs ---- */
  function seg(key, opts, cur) { return '<div class="seg" data-set="' + key + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + o[1] + "</button>"; }).join("") + "</div>"; }
  function input(word, val, ph, k) { return '<input type="text" data-word="' + word + '"' + (k != null ? ' data-k="' + k + '"' : "") + ' value="' + esc(val || "") + '" placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '">'; }
  function area(word, val, ph, rows, k) { return '<textarea rows="' + (rows || 2) + '" data-word="' + word + '"' + (k != null ? ' data-k="' + k + '"' : "") + ' placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '">' + esc(val || "") + "</textarea>"; }
  function siteTab() {
    var d = doc(), has = function (k) { return d.pages.some(function (x) { return x.kind === k; }); }, h = "";
    h += "<h3>Words</h3>" + input("site.name", d.name, "Your name") + input("site.contact", d.contact, "The line at the foot of every page");
    h += '<h3>Pages</h3><ol class="pages"><li class="' + (ST.page ? "" : "on") + '"><a href="' + R.href("/") + '" data-open="">The front page<small>' + { covers: "Covers", list: "A list", sheet: "A sheet" }[d.front] + '</small></a><span class="acts"></span></li>' + d.pages.map(function (x, i) {
      var k = x.kind === "story" ? M.count(x) + " photographs · " + x.arrangement : x.kind === "writing" ? "A note" : x.kind === "about" ? "About" : "Contact";
      return '<li class="' + (ST.page === x.id ? "on" : "") + (x.inNav ? "" : " off") + '"><a href="' + R.href("/" + x.id) + '" data-open="' + x.id + '">' + esc(title(x)) + "<small>" + esc(k) + (x.inNav ? "" : " · hidden") + '</small></a><span class="acts"><button type="button" data-act="page-up" data-id="' + x.id + '"' + (i === 0 ? " disabled" : "") + ' aria-label="Move up">&uarr;</button><button type="button" data-act="page-down" data-id="' + x.id + '"' + (i === d.pages.length - 1 ? " disabled" : "") + ' aria-label="Move down">&darr;</button><button type="button" data-act="page-nav" data-id="' + x.id + '" aria-label="' + (x.inNav ? "Hide from the navigation" : "Show in the navigation") + '">' + (x.inNav ? "&#9679;" : "&#9675;") + "</button></span></li>";
    }).join("") + "</ol>";
    h += '<div class="adds"><button type="button" data-act="page-add" data-kind="story">+ Story</button><button type="button" data-act="page-add" data-kind="writing">+ Note</button>' + (has("about") ? "" : '<button type="button" data-act="page-add" data-kind="about">+ About</button>') + (has("contact") ? "" : '<button type="button" data-act="page-add" data-kind="contact">+ Contact</button>') + "</div>";
    h += '<p class="hint">Stories hold photographs; a note holds words. A film page would be added the same way.</p>';
    h += "<h3>Plan</h3>" + seg("plan", [["free", "Free"], ["full", "Full"]], d.plan) + '<p class="hint">Free: twenty photographs and two looks. A preview switch, as in Folio.</p>';
    return h;
  }
  function pageTab() {
    var p = page(), d = doc();
    if (!p) {
      var shown = d.pages.filter(function (x) { return x.kind === "story" || x.kind === "writing"; });
      return "<h3>Words</h3>" + input("site.title", d.title, "Title, first part") + input("site.titleEm", d.titleEm, "Title, italic part") + input("site.kicker", d.kicker, "Above the title") + area("site.note", d.note, "A line or two to introduce the site") +
        "<h3>Form</h3>" + seg("front", [["covers", "Covers"], ["list", "A list"], ["sheet", "A sheet"]], d.front) + '<p class="hint">' + { covers: "Each story held large, one after another.", list: "A list of titles, one cover held beside it.", sheet: "Covers in equal cells, the whole site at a glance." }[d.front] + "</p>" +
        '<h3>What it shows, in order</h3><ol class="pages">' + shown.map(function (x) { var i = d.pages.indexOf(x); return '<li class="' + (x.inNav ? "" : "off") + '"><a href="' + R.href("/" + x.id) + '" data-open="' + x.id + '">' + esc(title(x)) + "<small>" + esc(x.kind === "story" ? M.count(x) + " photographs" : "A note") + (x.inNav ? "" : " · hidden") + '</small></a><span class="acts"><button type="button" data-act="page-up" data-id="' + x.id + '"' + (i === 0 ? " disabled" : "") + ' aria-label="Move up">&uarr;</button><button type="button" data-act="page-down" data-id="' + x.id + '"' + (i === d.pages.length - 1 ? " disabled" : "") + ' aria-label="Move down">&darr;</button><button type="button" data-act="page-nav" data-id="' + x.id + '" aria-label="' + (x.inNav ? "Hide" : "Show") + '">' + (x.inNav ? "&#9679;" : "&#9675;") + "</button></span></li>"; }).join("") + "</ol>" +
        '<div class="adds"><button type="button" data-act="page-add" data-kind="story">+ Story</button><button type="button" data-act="page-add" data-kind="writing">+ Note</button></div>';
    }
    var h = "<h3>Words</h3>" + input("page.title", p.title, "Title");
    if (p.kind === "story" || p.kind === "writing") h += input("page.titleEm", p.titleEm, "Italic part of the title") + input("page.kicker", p.kicker, "Above the title: a season, a place");
    if (p.kind === "story") {
      h += area("page.note", p.note, "A line or two to introduce it");
      h += "<h3>Arrangement</h3>" + seg("arrangement", [["held", "Held"], ["book", "Book"], ["passage", "Passage"], ["contact", "Contact"]], p.arrangement) + '<p class="hint">' + { held: "One photograph at a time, down the page.", book: "Spreads, turned two pages at a time.", passage: "A walk along one wall, sideways.", contact: "The whole story at a glance; one held when chosen." }[p.arrangement] + "</p>";
      h += '<h3>Photographs</h3><ol class="tray">' + p.items.map(function (it, k) {
        if (it.pause) return '<li class="pause"><span class="th ps">&para;</span><span class="t">' + esc(it.text) + "<small>A pause</small></span>" + acts(k, p.items.length) + "</li>";
        var w = M.LIB[it.f]; if (!w) return '<li class="pause"><span class="th ps">?</span><span class="t">A photograph this browser no longer has<small>Remove it, or add it again</small></span>' + acts(k, p.items.length) + "</li>";
        var tag = it.arrange === "with-next" ? "with the next" : it.arrange === "margin-note" ? "with a note" : it.full ? "full" : "alone";
        return "<li" + (ST.trayOpen === k ? ' class="openrow"' : "") + '><span class="th"><img src="' + w.src + '" alt=""></span><span class="t">' + esc(w.title) + "<small>" + esc(tag) + "</small></span>" + acts(k, p.items.length) + (ST.trayOpen === k ? '<div class="menu">' + arrangeOptions(p, k).map(function (o) { return '<button type="button" data-act="arr" data-k="' + k + '" data-key="' + o.key + '" aria-pressed="' + !!o.cur + '">' + esc(o.t) + "</button>"; }).join("") + '</div><div class="menu"><span style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ed-soft);align-self:center">Move to</span>' + R.stories().filter(function (s) { return s.id !== p.id; }).map(function (s) { return '<button type="button" data-act="arr" data-k="' + k + '" data-key="to:' + s.id + '">' + esc(title(s)) + "</button>"; }).join("") + '<button type="button" data-act="arr" data-k="' + k + '" data-key="to:new">A new story</button></div>' : "") + "</li>";
      }).join("") + "</ol>" + '<div class="adds"><button type="button" data-act="lib" data-page="' + p.id + '" data-after="' + (p.items.length - 1) + '">+ Photographs</button><button type="button" data-act="pause-end">+ A pause</button></div>';
    }
    if (p.kind === "writing") h += area("page.text", p.text, "The text", 8);
    if (p.kind === "about" || p.kind === "contact") h += p.paras.map(function (t, i) { return area("page.para", t, "A paragraph", 3, i); }).join("") + '<div class="adds"><button type="button" data-act="para-add">+ A paragraph</button></div>';
    h += '<div class="adds" style="margin-top:26px"><button type="button" data-act="page-remove" data-id="' + p.id + '">Remove this page</button></div>';
    return h;
  }
  function lookTab() {
    var d = doc(), cur = (d.theme && d.theme.look) || "quiet", keys = T.looksFor(d.template || "folio"), freeOk = ["quiet", "gallery"];
    return '<h3>Look</h3><div class="types looks">' + keys.map(function (k) {
      var L = T.LOOKS[k], v = L.vars || {}, f = v["--serif"] || T.TYPES.silk.display, bg = v["--silk"] || "#EEE9E7", ink = v["--ink"] || "#29222A", ac = v["--peony"] || "#B87B8A", locked = d.plan === "free" && freeOk.indexOf(k) < 0;
      return '<button type="button" class="' + (locked ? "locked" : "") + '" data-look="' + k + '" aria-pressed="' + (cur === k) + '" style="background:' + bg + ";color:" + ink + '"' + (locked ? ' aria-disabled="true" title="On the Full plan"' : "") + '><span class="aa" style="font-family:' + f + ';font-weight:' + (v["--title-weight"] || 300) + '">Aa<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + ac + ';margin-left:6px;vertical-align:middle"></i></span><span class="tn" style="color:' + ink + ';opacity:.7">' + L.name + "</span></button>";
    }).join("") + '</div><p class="hint">' + esc(T.LOOKS[cur].note || "Latent's own: silk, Newsreader, one rose.") + '</p><p class="hint">A look is a whole art direction over the same layout: type, colour, headline, labels, frames. Palette, accent, type pairing, mount, spacing and motion would follow here, as in Folio; left out of this study.</p>';
  }
  function renderPanel() {
    var keep = panel.querySelector(".scroll"), top = keep ? keep.scrollTop : 0;
    var h = "<header><b>" + (mode === "edit" ? "Edit" : "Customise") + '</b><button class="x" type="button" id="close">' + (mode === "edit" ? "Done" : "Close") + "</button></header>";
    if (mode === "edit") h += '<div class="tabs" role="tablist">' + [["site", "The site"], ["page", "This page"]].map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + "</button>"; }).join("") + "</div>";
    h += '<div class="scroll">' + (mode === "customise" ? lookTab() : tab === "page" ? pageTab() : siteTab()) + "</div>";
    h += '<footer><span>' + (saved ? "Saved on this device" : "Not saved") + '</span><button class="reset" type="button" id="reset">Reset</button></footer>';
    panel.innerHTML = h; var sc = panel.querySelector(".scroll"); if (sc) sc.scrollTop = top;
  }
  function acts(k, n) { return '<span class="acts"><button type="button" data-act="tray" data-k="' + k + '" aria-label="How it sits">&hellip;</button><button type="button" data-act="item-up" data-k="' + k + '"' + (k === 0 ? " disabled" : "") + ' aria-label="Earlier">&uarr;</button><button type="button" data-act="item-down" data-k="' + k + '"' + (k === n - 1 ? " disabled" : "") + ' aria-label="Later">&darr;</button><button type="button" data-act="item-remove" data-k="' + k + '" aria-label="Remove">&times;</button></span>'; }
  function openPanel(open, m) { if (m) mode = m; panel.classList.toggle("open", open); document.getElementById("tweak").setAttribute("aria-expanded", open && mode === "customise"); if (open) { root.dataset.panel = "on"; renderPanel(); } else delete root.dataset.panel; }
  function setEditing(on) {
    ST.editing = on; ST.arrOpen = null; document.getElementById("edit").textContent = on ? "Done" : "Edit"; document.getElementById("edit").setAttribute("aria-pressed", on); R.draw(true); meter();
    document.getElementById("pages").hidden = !on || !window.matchMedia("(max-width: 760px)").matches;
    if (on) { tab = "page"; if (!window.matchMedia("(max-width: 760px)").matches) openPanel(true, "edit"); if (/book|passage|contact/.test(ST.view)) toast("Words can be typed on the page. Order and pairs are set under This page."); } else if (mode === "edit") openPanel(false);
  }

  /* ---- the library ---- */
  var libFor = null, chosen = [], fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.accept = "image/*"; fileInput.multiple = true; fileInput.hidden = true; document.body.appendChild(fileInput);
  function libGrid() {
    var d = doc(), where = {};
    d.pages.forEach(function (p) { if (p.kind === "story") p.items.forEach(function (it) { if (!it.pause) (where[it.f] = where[it.f] || []).push(p.title); }); });
    var keys = Object.keys(M.LIB).sort(function (a, b) { return (M.LIB[a].sample ? 1 : 0) - (M.LIB[b].sample ? 1 : 0); });
    document.getElementById("libgrid").innerHTML = '<button type="button" id="libfile" class="new" style="aspect-ratio:3/2;display:grid;place-items:center">From your computer<br><span style="font-size:11.5px">JPEG, PNG or HEIC, up to 15 MB</span></button>' + keys.map(function (f) { var w = M.LIB[f]; return '<button type="button" data-f="' + f + '" aria-pressed="' + (chosen.indexOf(f) > -1) + '"><span class="fr2"><img src="' + w.src + '" alt="' + esc(w.alt) + '" loading="lazy"></span><span class="nm">' + esc(w.title) + '</span><span class="in">' + (where[f] ? "In " + esc(where[f].join(", ")) : w.sample ? "Sample · not placed" : "Not placed yet") + "</span></button>"; }).join("");
    var add = document.getElementById("libadd"); add.disabled = !chosen.length; add.textContent = chosen.length ? "Add " + chosen.length : "Add";
  }
  function openLib(pid, afterK) { libFor = { page: pid, after: afterK }; chosen = []; libGrid(); lib.classList.add("open"); }
  lib.addEventListener("click", function (e) {
    if (e.target.closest("#libfile")) return fileInput.click();
    var b = e.target.closest("#libgrid button[data-f]");
    if (b) { var f = b.dataset.f, i = chosen.indexOf(f); if (i > -1) chosen.splice(i, 1); else chosen.push(f); b.setAttribute("aria-pressed", i < 0); var add = document.getElementById("libadd"); add.disabled = !chosen.length; add.textContent = chosen.length ? "Add " + chosen.length : "Add"; return; }
    if (e.target.id === "libclose" || e.target === lib) lib.classList.remove("open");
    if (e.target.id === "libadd" && chosen.length) { lib.classList.remove("open"); addItems(libFor.page, libFor.after, chosen); }
  });
  fileInput.addEventListener("change", function () {
    var files = [].slice.call(fileInput.files); fileInput.value = ""; if (!files.length) return;
    document.getElementById("libnote").textContent = "Reading " + files.length + (files.length === 1 ? " photograph…" : " photographs…");
    Promise.all(files.map(function (f) { return M.importFile(f).then(function (w) { chosen.push(w.f); return w; }, function (err) { toast(err.message); return null; }); })).then(function (ws) { var unsaved = ws.some(function (w) { return w && w.unsaved; }); document.getElementById("libnote").textContent = unsaved ? "Added for this session; this browser would not keep them. They are chosen; press Add to place them." : "Added to your library. They are chosen; press Add to place them."; libGrid(); });
  });

  /* ---- publishing: the site as real files ---- */
  function slug(s) { return (s || "site").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site"; }
  function checks(d) {
    var out = [], n = photos(d);
    if (!d.name || d.name === "Your name") out.push({ warn: true, t: "The site has no name yet." });
    if (d.plan === "free" && n > 20) out.push({ warn: true, t: "Free holds twenty photographs; this site has " + n + ".", block: true });
    d.pages.forEach(function (p) { if (p.kind === "story" && !M.count(p)) out.push({ warn: true, t: "“" + title(p) + "” has no photographs yet." }); });
    if (!d.pages.some(function (p) { return p.kind === "story"; })) out.push({ warn: true, t: "There are no stories yet." });
    return out;
  }
  function renderPub(state) {
    var d = doc(), pub = M.published(), cs = checks(d), blocked = cs.some(function (c) { return c.block; }), n = photos(d), addr = slug(d.name) + ".latent.site";
    var h = "<h3>Address</h3><p class=\"addr\">" + esc(addr) + '</p><p class="soft">Where it will live. In this study the site is made as files you keep; a real publish puts the same files at this address, and later at your own domain.</p>';
    h += "<h3>What goes out</h3><ul><li><span>Pages</span><span>" + d.pages.length + "</span></li><li><span>Photographs</span><span>" + n + "</span></li><li><span>Look</span><span>" + esc(T.LOOKS[(d.theme && d.theme.look) || "quiet"].name) + "</span></li><li><span>Front page</span><span>" + { covers: "Covers", list: "A list", sheet: "A sheet" }[d.front] + "</span></li></ul>";
    if (cs.length) h += "<h3>Before you do</h3>" + cs.map(function (c) { return '<p class="' + (c.warn ? "warn" : "") + '">' + esc(c.t) + "</p>"; }).join("");
    if (state === "building") h += '<p style="margin-top:22px">Making the files…</p>';
    else if (state && state.done) h += '<h3>Published</h3><p>' + new Date(state.at).toLocaleString() + " · " + state.files + " files · " + (state.bytes / 1048576).toFixed(1) + ' MB</p><a class="go" href="site.html?published#/" target="_blank" rel="noopener">Open the published site</a><a class="go quiet" href="' + state.url + '" download="' + esc(slug(d.name)) + '-site.zip">Download the files</a>';
    else h += '<button type="button" class="go" id="pubgo"' + (blocked ? " disabled" : "") + ">" + (pub ? "Publish again" : "Publish") + "</button>" + (pub ? '<a class="go quiet" href="site.html?published#/" target="_blank" rel="noopener">Open the last published site</a><p class="soft" style="margin-top:14px">Last published ' + new Date(pub.at).toLocaleString() + (JSON.stringify(pub.doc) !== JSON.stringify(d) ? ", changed since." : ".") + "</p>" : "");
    document.getElementById("pubbody").innerHTML = h;
  }
  function openPub() { renderPub(); pubsheet.classList.add("open"); }
  /* a store-only zip: enough for files a browser can read, no compression library needed */
  var CRC = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = -1; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    function u16(v) { return [v & 255, (v >> 8) & 255]; } function u32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data), crc = crc32(data);
      var head = new Uint8Array([].concat(u32(0x04034b50), u16(20), u16(0x800), u16(0), u16(0x21), u16(0x5A26), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0)));
      parts.push(head, name, data);
      central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x800), u16(0), u16(0x21), u16(0x5A26), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), name);
      off += head.length + name.length + data.length;
    });
    var cdSize = central.reduce(function (a, c) { return a + c.length; }, 0);
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(off), u16(0)));
    return new Blob(parts.concat(central, [end]), { type: "application/zip" });
  }
  function fetchBytes(u) { return fetch(u).then(function (r) { return r.arrayBuffer(); }).then(function (b) { return new Uint8Array(b); }); }
  /* The dev server hands css and js back as modules; ?raw gives the file itself, wrapped. A plain server ignores the query. */
  function fetchText(u) { return fetch(u + "?raw").then(function (r) { return r.text(); }).then(function (s) { var m = /^export default ("(?:[^"\\]|\\.)*")/.exec(s); return m ? JSON.parse(m[1]) : s; }); }
  function staticPage(d, p, base, libOut) {
    var look = (d.theme && d.theme.look) || "quiet", vars = look !== "quiet" && T.LOOKS[look] ? T.LOOKS[look].vars : {}, style = Object.keys(vars).map(function (k) { return k + ":" + vars[k]; }).join(";");
    var html = R.pageHtml(d, p ? p.id : null, base), ttl = p ? title(p) + " · " + d.name : d.name;
    return '<!doctype html>\n<html lang="en" data-look="' + look + '" data-preview="on"' + (style ? ' style="' + esc(style) + '"' : "") + '>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>' + esc(ttl) + '</title>\n<meta name="description" content="' + esc(p && p.note ? p.note : d.note) + '">\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;1,6..72,300;1,6..72,400&family=Instrument+Sans:wght@400;500&family=Instrument+Serif:ital@0;1&family=Libre+Caslon+Text:ital,wght@0,400;1,400&family=Karla:wght@400;500&family=IBM+Plex+Mono:wght@400;500&family=Archivo:wght@400;500;600;700&family=Jost:wght@300;400;500&family=Fraunces:ital,wght@0,400;0,800;1,400;1,800&family=Courier+Prime:wght@400;700&family=Young+Serif&family=DM+Sans:wght@400;500&family=Bodoni+Moda:ital,wght@0,400;1,400&display=swap">\n<link rel="stylesheet" href="' + base + 'assets/ways.css">\n<link rel="stylesheet" href="' + base + 'assets/looks.css">\n<link rel="stylesheet" href="' + base + 'assets/site.css">\n</head>\n<body><div id="app">' + html + '</div>\n<script>window.STATIC=' + JSON.stringify({ page: p ? p.id : null, base: base, doc: d, lib: libOut }) + '</script>\n<script src="' + base + 'assets/data.js"></script><script src="' + base + 'assets/theme.js"></script><script src="' + base + 'assets/model.js"></script><script src="' + base + 'assets/render.js"></script>\n<!-- Made with Latent Wall -->\n</body>\n</html>\n';
  }
  function build() {
    var d = JSON.parse(JSON.stringify(doc())), used = {}, libOut = {};
    d.pages.forEach(function (p) { if (p.kind === "story") p.items.forEach(function (it) { if (!it.pause && M.LIB[it.f]) used[it.f] = 1; }); if (p.kind === "writing" && p.image && M.LIB[p.image]) used[p.image] = 1; });
    Object.keys(used).forEach(function (f) { var w = M.LIB[f]; libOut[f] = { f: f, r: w.r, w: w.w, h: w.h, alt: w.alt, title: w.title, date: w.date, file: w.file }; });
    var files = [], enc = new TextEncoder();
    files.push({ name: "index.html", data: enc.encode(staticPage(d, null, "", libOut)) });
    d.pages.forEach(function (p) { files.push({ name: p.id + "/index.html", data: enc.encode(staticPage(d, p, "../", libOut)) }); });
    var texts = [["assets/ways.css", "../ways/ways.css"], ["assets/site.css", "site.css"], ["assets/looks.css", "../../shared/looks.css"], ["assets/data.js", "../ways/data.js"], ["assets/theme.js", "../../shared/theme.js"], ["assets/model.js", "model.js"], ["assets/render.js", "render.js"]];
    return Promise.all(texts.map(function (t) { return fetchText(t[1]).then(function (s) { files.push({ name: t[0], data: enc.encode(s) }); }); }).concat(Object.keys(used).map(function (f) {
      var w = M.LIB[f]; return (w.bytes ? Promise.resolve(new Uint8Array(w.bytes)) : fetchBytes(w.src)).then(function (b) { files.push({ name: "assets/img/" + w.file, data: b }); });
    }))).then(function () { var blob = zip(files); return { blob: blob, files: files.length, bytes: blob.size }; });
  }
  var lastUrl = null;
  function publishNow() {
    renderPub("building");
    build().then(function (out) { if (lastUrl) URL.revokeObjectURL(lastUrl); lastUrl = URL.createObjectURL(out.blob); var rec = M.publish(doc()); renderPub({ done: true, at: rec.at, files: out.files, bytes: out.bytes, url: lastUrl }); meter(); window.SiteEdit.lastBuild = out; }, function (err) { toast("Could not make the files: " + err.message); renderPub(); });
  }

  /* ---- actions, from the page or the panel ---- */
  function act(t) {
    var a = t.dataset.act, k = +t.dataset.k;
    if (a === "page-add") return addPage(t.dataset.kind);
    if (a === "page-up") return movePage(t.dataset.id, -1);
    if (a === "page-down") return movePage(t.dataset.id, 1);
    if (a === "page-nav") { snap(); var p = doc().pages.filter(function (x) { return x.id === t.dataset.id; })[0]; p.inNav = !p.inNav; return commit(); }
    if (a === "page-remove") return removePage(t.dataset.id);
    if (a === "lib") return openLib(t.dataset.page, +t.dataset.after);
    if (a === "pause-end") { var s = story(); if (!s) return; snap(); s.items.push({ pause: true, label: "From the story", text: "A few words here." }); return commit(); }
    if (a === "para-add") { var pg = page(); snap(); pg.paras.push("Another paragraph."); return commit(); }
    if (a === "item-up") return moveItem(k, -1);
    if (a === "item-down") return moveItem(k, 1);
    if (a === "item-remove") return removeItem(k);
    if (a === "arr") return arrange(k, t.dataset.key);
    if (a === "arrange") { ST.arrOpen = ST.arrOpen === k && ST.arrMode !== "moveto" ? null : k; ST.arrMode = ""; return R.draw(true); }
    if (a === "moveto") { ST.arrOpen = ST.arrOpen === k && ST.arrMode === "moveto" ? null : k; ST.arrMode = "moveto"; return R.draw(true); }
    if (a === "tray") { ST.trayOpen = ST.trayOpen === k ? null : k; return renderPanel(); }
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]"); if (t && !t.disabled) { e.preventDefault(); return act(t); }
    var tb = e.target.closest("#panel [data-tab]"); if (tb) { tab = tb.dataset.tab; return renderPanel(); }
    var op = e.target.closest("#panel a[data-open]"); if (op) { tab = "page"; if (op.dataset.open === "" && !location.hash.replace(/^#\/?/, "")) { e.preventDefault(); renderPanel(); } }
    var lk = e.target.closest("#panel [data-look]"); if (lk) { if (lk.classList.contains("locked")) return toast("This look is on the Full plan."); snap(); doc().theme = { look: lk.dataset.look }; return commit(); }
    var s = e.target.closest(".seg[data-set] button"); if (s) { snap(); var key = s.parentNode.dataset.set, v = s.dataset.v; if (key === "front") doc().front = v; else if (key === "plan") { doc().plan = v; if (v === "free" && doc().theme && ["quiet", "gallery"].indexOf(doc().theme.look) < 0) doc().theme = { look: "quiet" }; } else if (key === "arrangement" && story()) story().arrangement = v; ST.arrOpen = null; return commit(false); }
    if (e.target.id === "close") { if (mode === "edit") setEditing(false); else openPanel(false); }
    if (e.target.id === "reset") { if (confirm("Put the study back to the example?")) { snap(); ST.doc = M.example(); commit(); } }
    if (e.target.id === "pages") openPanel(true, "edit");
    if (e.target.id === "tweak") openPanel(!(panel.classList.contains("open") && mode === "customise"), "customise");
    if (e.target.id === "pub") { openPanel(false); openPub(); }
    if (e.target.id === "pubclose" || e.target === pubsheet) pubsheet.classList.remove("open");
    if (e.target.id === "pubgo") publishNow();
    if (e.target.id === "edit") setEditing(!ST.editing);
    if (e.target.id === "undo") undo(); if (e.target.id === "redo") redo();
    if (ST.arrOpen != null && !e.target.closest(".arr") && !e.target.closest("[data-act]")) { ST.arrOpen = null; R.draw(true); }
  });
  panel.addEventListener("input", function (e) { var t = e.target; if (t.dataset.word) setWord(t.dataset.word, t.value, t.dataset.k); });
  panel.addEventListener("change", function (e) { if (e.target.dataset.word) { past.push(JSON.stringify(doc())); R.draw(true); renderPanel(); } });
  /* What was typed, with line breaks kept and without the look's text-transform (innerText would hand back UPPERCASE labels). */
  function plain(el) { var out = ""; el.childNodes.forEach(function (n) { if (n.nodeType === 3) out += n.nodeValue; else if (n.nodeName === "BR") out += "\n"; else if (n.nodeType === 1) { if (/^(DIV|P)$/.test(n.nodeName) && out && !/\n$/.test(out)) out += "\n"; out += plain(n); } }); return out; }
  document.addEventListener("focusin", function (e) { if (e.target.isContentEditable) e.target.dataset.before = plain(e.target); });
  document.addEventListener("focusout", function (e) { var t = e.target; if (!t.isContentEditable || !t.dataset.ed) return; var now = plain(t); if (now !== t.dataset.before) { past.push(JSON.stringify(doc())); future = []; setWord(t.dataset.ed, now, t.dataset.k); if (panel.classList.contains("open")) renderPanel(); } });
  document.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.isContentEditable && e.target.tagName !== "P" && e.target.dataset.ed !== "page.text") { e.preventDefault(); e.target.blur(); } if (e.key === "Escape") { lib.classList.remove("open"); pubsheet.classList.remove("open"); if (ST.arrOpen != null) { ST.arrOpen = null; R.draw(true); } } });
  /* Another window saved this site: take its version, so nothing here can overwrite it later. */
  window.addEventListener("storage", function (ev) { if (ev.key !== M.KEY || !ev.newValue) return; try { var d = JSON.parse(ev.newValue); if (d.rev === doc().rev) return; if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur(); ST.doc = d; past = []; future = []; R.draw(true); if (panel.classList.contains("open")) renderPanel(); meter(); toast("Updated from another window."); } catch (err) {} });
  window.addEventListener("hashchange", function () { if (panel.classList.contains("open")) { if (mode === "edit") tab = "page"; renderPanel(); } });
  window.SiteEdit = {
    arrangeOptions: arrangeOptions, afterDraw: function () { meter(); }, build: build,
    start: function () {
      if (ST.published) return;
      if (/[?&]edit/.test(location.search)) setEditing(true);
      if (/[?&]panel=look/.test(location.search)) openPanel(true, "customise");
      if (/[?&]lib/.test(location.search) && page()) openLib(page().id, page().items.length - 1);
      if (/[?&]pub\b/.test(location.search)) openPub();
      meter();
    }
  };
})();
