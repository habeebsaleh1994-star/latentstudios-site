/* One series, read by every arrangement in this study. Same order, same pairs, same note, same pause as Folio's seed document. */
(function () {
  var I = "../../folio/img/";
  function w(file, title, date, alt, arrange, r, extra) {
    var o = { src: I + file + ".jpg", title: title, date: date, alt: alt, arrange: arrange || "alone", r: r || 1.5 };
    for (var k in extra || {}) o[k] = extra[k];
    return o;
  }
  var items = [
    w("12", "The road in", "7 Mar 2025", "A road curving through pine hills under a pale sky, white flowers along its edge", "alone", 1.5, { full: true }),
    w("10", "Bougainvillea", "20 Nov 2025", "Pink bougainvillea spilling over the roof of a small concrete building"),
    w("5", "He looked back", "3 Dec 2025", "Close portrait of an elderly man with white hair, smiling quietly"),
    w("3", "The game", "17 Dec 2023", "An old man holding a pale fruit beside a cracked concrete wall, a ball on the ground", "with-next"),
    w("4", "The kitchen", "3 Dec 2025", "An old man in a dark coat standing at a stove in a small yellow kitchen"),
    w("1", "Afternoon, the street", "16 Jun 2025", "Three children racing along a street, one on a bicycle"),
    { pause: true, label: "From the series", text: "Most of what these photographs show is not rare. It is simply about to be gone." },
    w("8", "The pine", "24 Mar 2025", "A tall pine tree leaning over a quiet village road with a lone figure walking", "margin-note", 0.667, { note: "A pine above the last turn of the village road." }),
    w("6", "Under the leaves", "4 May 2025", "A man standing beneath a dense green tree, only his legs visible", "alone", 1.5, { full: true }),
    w("7", "Through the gate", "10 Nov 2025", "A white cat seen through iron bars in a stone courtyard"),
    w("11", "Parked, waiting", "10 Nov 2025", "A grey sedan under a dust cover in a stone garage", "with-next"),
    w("9", "Wall, late light", "3 Sep 2025", "Thorn-branch shadows on a sunlit plaster wall"),
    w("2", "The valley", "22 Sep 2025", "Two men talking at a railing above an olive valley, an old tree trunk in the foreground", "alone", 1.333)
  ];
  var works = [], groups = [], n = 0;
  items.forEach(function (it) { if (!it.pause) { n++; it.i = n - 1; it.n = ("0" + n).slice(-2); works.push(it); } });
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (it.pause) groups.push({ type: "pause", label: it.label, text: it.text });
    else if (it.arrange === "with-next" && items[i + 1] && !items[i + 1].pause) { groups.push({ type: "pair", works: [it, items[i + 1]] }); i++; }
    else if (it.arrange === "margin-note") groups.push({ type: "note", works: [it], note: it.note });
    else groups.push({ type: "single", works: [it] });
  }
  window.SERIES = {
    name: "Habib Saleh", kicker: "A photographic series · Lebanon · 2023 – 2025", title: "Before it", titleEm: "disappears",
    note: "Twelve photographs from villages in the Lebanese hills. Ordinary things, made while they were still there.",
    aboutTitle: "About the series",
    about: ["Habib Saleh photographs and makes films. This series was made over two years, on visits to villages in Lebanon, in the light of ordinary afternoons.", "The photographs are available as prints and as a short film."],
    contact: "Prints and enquiries · hello@example.com",
    works: works, groups: groups,
    esc: function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  };
})();
