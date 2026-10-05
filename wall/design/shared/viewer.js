/* The picture viewer: one work large, with its details. Fills the screen exactly, never larger; the page behind does not move.
   LatentViewer.open(items, index) where items are [{ src, alt, title, meta }]. Arrows and Escape work; so do the on-screen buttons. */
(function () {
  var box = null, items = [], at = 0, opener = null;
  function build() {
    if (box) return box;
    box = document.createElement("div"); box.className = "lb"; box.hidden = true; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Picture viewer");
    box.innerHTML = '<div class="stage"><img alt=""></div><div class="meta"><b></b><span></span></div><button class="x" type="button">Close</button><button class="pv" type="button" aria-label="Previous">&larr;</button><button class="nx" type="button" aria-label="Next">&rarr;</button>';
    document.body.appendChild(box);
    box.addEventListener("click", function (e) {
      var t = e.target;
      if (t.classList.contains("x") || t === box || t.classList.contains("stage")) close();
      else if (t.classList.contains("pv")) step(-1); else if (t.classList.contains("nx")) step(1);
    });
    document.addEventListener("keydown", function (e) { if (box.hidden) return; if (e.key === "Escape") close(); else if (e.key === "ArrowLeft") step(-1); else if (e.key === "ArrowRight") step(1); });
    return box;
  }
  function show() {
    var it = items[at], v = build(), img = v.querySelector("img");
    img.src = it.src; img.alt = it.alt || it.title || "";
    v.querySelector("b").textContent = it.title || ""; v.querySelector("span").textContent = it.meta || "";
    v.querySelector(".pv").hidden = v.querySelector(".nx").hidden = items.length < 2;
    v.hidden = false; document.documentElement.classList.add("lb-open"); v.querySelector(".x").focus();
  }
  function step(d) { at = (at + d + items.length) % items.length; show(); }
  function close() { if (!box) return; box.hidden = true; document.documentElement.classList.remove("lb-open"); if (opener && opener.focus) opener.focus(); }
  window.LatentViewer = { open: function (list, index) { items = list; at = index || 0; opener = document.activeElement; show(); }, close: close, isOpen: function () { return !!box && !box.hidden; } };
})();
