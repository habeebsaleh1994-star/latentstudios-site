/* The picture viewer: one work large, with its details. Fills the screen exactly, never larger; the page behind does not move.
   LatentViewer.open(items, index) where items are [{ src, alt, title, meta, cm }]. Arrows and Escape work; so do the on-screen buttons.
   A work with a real size (cm: { w, h }) can be shown at life size: as many screen pixels as it is centimetres, by a scale the viewer
   learns once from a bank card held against the screen (kept in this browser as latent-ppcm). */
(function () {
  var box = null, items = [], at = 0, opener = null, life = false, CARD = 8.56; // a bank card is 85.60 × 53.98 mm
  function ppcm() { var v = parseFloat(localStorage.getItem("latent-ppcm")); return v > 10 && v < 200 ? v : 96 / 2.54; }
  function build() {
    if (box) return box;
    box = document.createElement("div"); box.className = "lb"; box.hidden = true; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Picture viewer");
    box.innerHTML = '<div class="stage"><img alt=""></div><div class="meta"><b></b><span></span><button class="life" type="button" hidden>Life size</button></div><div class="cal" hidden><p>Hold a bank card against the screen and slide until the outline is its size.</p><div class="card"></div><input type="range" min="20" max="90" step="0.2" aria-label="Scale"><button type="button" class="done">Done</button></div><button class="x" type="button">Close</button><button class="pv" type="button" aria-label="Previous">&larr;</button><button class="nx" type="button" aria-label="Next">&rarr;</button>';
    document.body.appendChild(box);
    box.addEventListener("click", function (e) {
      var t = e.target;
      if (t.classList.contains("x") || t === box || t.classList.contains("stage")) close();
      else if (t.classList.contains("pv")) step(-1); else if (t.classList.contains("nx")) step(1);
      else if (t.classList.contains("life")) { life = !life; fit(); }
      else if (t.classList.contains("match")) { box.querySelector(".cal").hidden = false; box.querySelector("input").value = ppcm(); card(); }
      else if (t.classList.contains("done")) { box.querySelector(".cal").hidden = true; }
    });
    box.querySelector("input").addEventListener("input", function (e) { try { localStorage.setItem("latent-ppcm", e.target.value); } catch (err) { /* a private window may refuse */ } card(); fit(); });
    document.addEventListener("keydown", function (e) { if (box.hidden) return; if (e.key === "Escape") close(); else if (e.key === "ArrowLeft") step(-1); else if (e.key === "ArrowRight") step(1); });
    return box;
  }
  function card() { box.querySelector(".card").style.width = (CARD * ppcm()).toFixed(1) + "px"; box.querySelector(".card").style.height = (5.398 * ppcm()).toFixed(1) + "px"; }
  function cmText(v) { return (Math.round(v * 10) / 10).toString(); }
  /* at life size the picture takes its centimetres in pixels and the stage scrolls; otherwise it fits the screen */
  function fit() {
    var it = items[at], img = box.querySelector("img"), b = box.querySelector(".life"), m = box.querySelector(".meta span");
    if (!it.cm) life = false;
    box.classList.toggle("life", life);
    if (life) { var k = ppcm(); img.style.width = (it.cm.w * k).toFixed(1) + "px"; img.style.height = (it.cm.h * k).toFixed(1) + "px"; m.innerHTML = "Life size · " + cmText(it.cm.w) + " × " + cmText(it.cm.h) + " cm · <button type=\"button\" class=\"match\">Not quite? Match a card</button>"; }
    else { img.style.width = img.style.height = ""; m.textContent = it.meta || ""; box.querySelector(".cal").hidden = true; }
    b.hidden = !it.cm; b.textContent = life ? "Fit the screen" : "Life size"; b.setAttribute("aria-pressed", String(life));
  }
  function show() {
    var it = items[at], v = build(), img = v.querySelector("img");
    img.src = it.src; img.alt = it.alt || it.title || "";
    v.querySelector("b").textContent = it.title || "";
    v.querySelector(".pv").hidden = v.querySelector(".nx").hidden = items.length < 2;
    fit();
    v.hidden = false; document.documentElement.classList.add("lb-open"); v.querySelector(".x").focus();
  }
  function step(d) { at = (at + d + items.length) % items.length; show(); }
  function close() { if (!box) return; box.hidden = true; life = false; document.documentElement.classList.remove("lb-open"); if (opener && opener.focus) opener.focus(); }
  window.LatentViewer = { open: function (list, index) { items = list; at = index || 0; life = false; opener = document.activeElement; show(); }, close: close, isOpen: function () { return !!box && !box.hidden; }, ppcm: ppcm };
})();
