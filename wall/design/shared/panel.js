/* The customise panel, shared by every room. A room says which sections it has; the panel does the rest. */
(function () {
  var T = window.FolioTheme, E = window.LatentEntitlements;
  var LABEL = { look: "This look", palette: "These palettes", type: "These type pairings", mount: "This mount", space: "This spacing", motion: "This motion", mode: "This mode", read: "This reading size", accentFromWork: "Accents drawn from your work" };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function mount(cfg) {
    var st = cfg.state, panel = cfg.panel, btn = cfg.btn, note = "";
    var has = function (s) { return cfg.sections.indexOf(s) > -1; };

    function seg(key, title, opts) {
      return "<h3>" + title + '</h3><div class="seg" data-key="' + key + '">' + opts.map(function (o) {
        var ok = E.allows(key, o[0]);
        return '<button type="button" data-v="' + o[0] + '" class="' + (ok ? "" : "locked") + '" aria-pressed="' + (st[key] === o[0]) + '"' + (ok ? "" : ' aria-disabled="true"') + ">" + o[1] + "</button>";
      }).join("") + "</div>";
    }
    function ground() { var p = T.PALETTES[st.palette]; return document.documentElement.style.colorScheme === "dark" ? p.dark : p.light; }
    function accents() {
      var dark = document.documentElement.style.colorScheme === "dark", own = T.accentFor(st.look, null, dark, st.palette).peony;
      var list = [{ hex: "", shown: own, own: true }].concat(T.ACCENTS.map(function (a) { return { hex: a, shown: T.accentFor(st.look, a, dark, st.palette).peony }; }));
      (cfg.accentsFromWork ? cfg.accentsFromWork() : []).forEach(function (a) { list.push({ hex: a, work: true, shown: T.accentFor(st.look, a, dark, st.palette).peony }); });
      return list.map(function (a) {
        var ok = !a.work || E.allows("accentFromWork"), pressed = a.own ? !st.accent : !!st.accent && st.accent.toLowerCase() === a.hex.toLowerCase();
        return '<button type="button" class="sw' + (ok ? "" : " locked") + (a.own ? " own" : "") + '" data-accent="' + a.hex + '" data-work="' + !!a.work + '" aria-pressed="' + pressed + '" aria-label="' + (a.own ? "The look's own accent" : "Accent " + a.hex + (a.work ? ", from your work" : "")) + '"><i style="background:' + a.shown + '"></i></button>';
      }).join("");
    }
    function render() {
      var keep = panel.querySelector(".scroll"), keepTop = keep ? keep.scrollTop : 0, hadFocus = document.activeElement && panel.contains(document.activeElement) ? document.activeElement : null;
      var open = panel.classList.contains("open"), P = T.PALETTES, Y = T.TYPES, h = '<header><b>Customise</b><button class="x" type="button" id="close">Close</button></header><div class="scroll">';
      if (has("words")) {
        h += "<h3>Words</h3>" + cfg.words.map(function (w) {
          return w.kind === "area" ? '<textarea rows="3" data-word="' + w.key + '" aria-label="' + w.label + '">' + esc(cfg.getWord(w.key)) + "</textarea>" : '<input type="text" data-word="' + w.key + '" value="' + esc(cfg.getWord(w.key)) + '" aria-label="' + w.label + '">';
        }).join("");
      }
      if (has("look")) {
        var LK = T.LOOKS, avail = T.looksFor(cfg.template);
        h += '<h3>Look</h3><div class="types looks">' + avail.map(function (k) {
          var v = LK[k].vars || {}, f = v["--serif"] || T.TYPES.silk.display, bg = v["--silk"] || "#EEE9E7", ink = v["--ink"] || "#29222A", ac = v["--peony"] || "#B87B8A";
          return '<button type="button" class="' + (E.allows("look", k) ? "" : "locked") + '" data-look="' + k + '" aria-pressed="' + (st.look === k) + '" style="background:' + bg + ";color:" + ink + '"><span class="aa" style="font-family:' + f + ';font-weight:' + (v["--title-weight"] || 300) + '">Aa<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + ac + ';margin-left:6px;vertical-align:middle"></i></span><span class="tn" style="color:' + ink + ';opacity:.7">' + LK[k].name + "</span></button>";
        }).join("") + "</div>";
      }
      if (has("palette") && st.look === "quiet") {
        h += '<h3>Palette</h3><div class="swatches">' + Object.keys(P).map(function (k) {
          var ok = E.allows("palette", k), c = P[k].light, d = P[k].dark;
          return '<button type="button" class="sw' + (ok ? "" : " locked") + '" data-palette="' + k + '" aria-pressed="' + (st.palette === k) + '" aria-label="' + P[k].name + '" title="' + P[k].name + '"><i style="background:linear-gradient(135deg,' + c.silk + " 50%," + c.ink + ' 50%)"></i></button>';
        }).join("") + '</div><span class="sw-label">' + P[st.palette].name + "</span>";
      }
      if (has("mode") && st.look === "quiet") h += seg("mode", "Light", [["light", "Day"], ["dark", "Night"], ["system", "Follow device"]]);
      if (has("accent")) h += '<h3>Accent</h3><div class="swatches" id="accents">' + accents() + '</div><span class="sw-label">' + (st.accent ? "" : "Using the look's own accent.") + ((cfg.accentsFromWork && cfg.accentsFromWork().length) ? " The last " + cfg.accentsFromWork().length + " are drawn from your photographs." : "") + "</span>";
      if (has("type") && st.look === "quiet") {
        h += '<h3>Type</h3><div class="types">' + Object.keys(Y).map(function (k) {
          return '<button type="button" class="' + (E.allows("type", k) ? "" : "locked") + '" data-type="' + k + '" aria-pressed="' + (st.type === k) + '"><span class="aa" style="font-family:' + Y[k].display + '">Aa</span><span class="tn">' + Y[k].name + "</span></button>";
        }).join("") + "</div>";
      }
      if (has("options") && cfg.options && cfg.options.length) {
        h += "<h3>This template</h3>" + cfg.options.map(function (o) {
          return '<div class="optrow"><span class="optname">' + o.title + '</span><div class="seg" data-opt="' + o.key + '">' + o.choices.map(function (c) { return '<button type="button" data-v="' + c[0] + '" aria-pressed="' + ((st.options && st.options[o.key] || o.def) === c[0]) + '">' + c[1] + "</button>"; }).join("") + "</div></div>";
        }).join("");
      }
      if (has("mount")) h += seg("mount", "Mount", [["bare", "Bare"], ["line", "Line"], ["matte", "Matted"]]);
      if (has("read")) h += seg("read", "Reading size", [["small", "Small"], ["standard", "Standard"], ["large", "Large"]]);
      if (has("space")) h += seg("space", "Spacing", [["airy", "Airy"], ["standard", "Standard"], ["close", "Close"]]);
      if (has("motion")) h += seg("motion", "Motion", [["slow", "Slow"], ["still", "Still"]]);
      h += '<p class="note" id="note" aria-live="polite">' + esc(note) + "</p></div>";
      h += '<footer><span class="plan" role="group" aria-label="Preview plan">Preview plan ' + Object.keys(E.PLANS).map(function (k) { return '<button type="button" data-plan="' + k + '" aria-pressed="' + (E.plan === k) + '">' + E.PLANS[k].name + "</button>"; }).join("") + '</span><button class="reset" type="button" id="reset">Reset</button></footer>';
      panel.innerHTML = h;
      if (open) panel.classList.add("open");
      var sc = panel.querySelector(".scroll"); if (sc) sc.scrollTop = keepTop;
      if (hadFocus) {
        var again = hadFocus.dataset && (hadFocus.dataset.palette ? '[data-palette="' + hadFocus.dataset.palette + '"]' : hadFocus.dataset.type ? '[data-type="' + hadFocus.dataset.type + '"]' : hadFocus.dataset.accent ? '[data-accent="' + hadFocus.dataset.accent + '"]' : hadFocus.dataset.v ? '[data-key="' + (hadFocus.closest(".seg") || {}).dataset.key + '"] [data-v="' + hadFocus.dataset.v + '"]' : hadFocus.dataset.plan ? '[data-plan="' + hadFocus.dataset.plan + '"]' : "");
        var n = again && panel.querySelector(again); if (n) n.focus({ preventScroll: true });
      }
    }

    function say(m) { note = m; var n = document.getElementById("note"); if (n) n.textContent = m; }
    function set(group, value) {
      if (!E.allows(group, value)) { say((LABEL[group] || "That") + " " + (group === "palette" || group === "type" ? "are" : "is") + " part of the " + E.PLANS.full.name + " plan."); return; }
      note = ""; st[group] = value; cfg.refresh("theme"); render();
    }
    /* a plan change can leave a choice that the new plan does not include: fall back to the first one it does */
    function conform() {
      var fb = { look: T.looksFor(cfg.template), palette: Object.keys(T.PALETTES), type: Object.keys(T.TYPES), mount: ["bare", "line", "matte"], space: ["standard", "airy", "close"], motion: ["slow", "still"], mode: ["system", "light", "dark"], read: ["standard", "small", "large"] };
      Object.keys(fb).forEach(function (g) { if (st[g] != null && !E.allows(g, st[g])) { st[g] = fb[g].filter(function (v) { return E.allows(g, v); })[0] || T.DEFAULTS[g]; } });
      if (!E.allows("accentFromWork") && st.accent && (cfg.accentsFromWork ? cfg.accentsFromWork() : []).indexOf(st.accent) > -1) st.accent = null;
    }

    panel.addEventListener("click", function (e) {
      var t = e.target.closest("button"); if (!t) return;
      if (t.id === "close") return toggle(false);
      if (t.id === "reset") { Object.keys(T.DEFAULTS).forEach(function (k) { st[k] = JSON.parse(JSON.stringify(T.DEFAULTS[k])); }); st.words = {}; conform(); note = ""; cfg.refresh("full"); return render(); }
      if (t.dataset.plan) { E.set(t.dataset.plan); conform(); note = t.dataset.plan === "free" ? "Previewing the Free plan: " + E.limit("photographs") + " photographs, no video." : "Previewing the full plan."; cfg.refresh("full"); return render(); }
      if (t.dataset.look) return set("look", t.dataset.look);
      if (t.dataset.palette) return set("palette", t.dataset.palette);
      if (t.dataset.type) return set("type", t.dataset.type);
      if (t.dataset.accent !== undefined) { if (t.dataset.work === "true" && !E.allows("accentFromWork")) return say(LABEL.accentFromWork + " are part of the " + E.PLANS.full.name + " plan."); note = ""; st.accent = t.dataset.accent || null; cfg.refresh("theme"); return render(); }
      var s = t.closest(".seg");
      if (s && s.dataset.opt && t.dataset.v) { note = ""; st.options = Object.assign({}, st.options); st.options[s.dataset.opt] = t.dataset.v; cfg.refresh("theme"); return render(); }
      if (s && t.dataset.v) return set(s.dataset.key, t.dataset.v);
    });
    panel.addEventListener("input", function (e) { var k = e.target.dataset.word; if (k) cfg.onWord(k, e.target.value); });

    function toggle(on) {
      on = on == null ? !panel.classList.contains("open") : on;
      panel.classList.toggle("open", on); btn.setAttribute("aria-expanded", on); btn.style.visibility = on ? "hidden" : "visible";
      if (on) { var f = panel.querySelector("button, input"); f && f.focus(); } else btn.focus();
    }
    btn.addEventListener("click", function () { toggle(true); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("open")) toggle(false); });

    conform(); render();
    return { render: render, toggle: toggle, conform: conform };
  }

  window.LatentPanel = { mount: mount };
})();
