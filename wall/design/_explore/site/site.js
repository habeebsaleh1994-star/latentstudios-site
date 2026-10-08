/* A whole site for the study: five stories, a note, About and Contact. Works come from ../ways/data.js; some repeat between stories. */
(function () {
  var S = window.SERIES, byFile = {};
  S.works.forEach(function (w) { byFile[/(\d+)\.jpg$/.exec(w.src)[1]] = w; });
  function pick(list) {
    var n = 0; return list.map(function (it) {
      var w = Object.assign({}, byFile[it[0]]); n++; w.n = ("0" + n).slice(-2); w.i = n - 1; w.arrange = it[1] || "alone"; w.note = it[2] || ""; w.full = !!it[3]; return w;
    });
  }
  function story(id, title, titleEm, kicker, note, arrangement, works, pauseAfter, pause) {
    var items = []; works.forEach(function (w, i) { items.push(w); if (pauseAfter === i && pause) items.push({ pause: true, label: "From the story", text: pause }); });
    var groups = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.pause) groups.push({ type: "pause", label: it.label, text: it.text });
      else if (it.arrange === "with-next" && items[i + 1] && !items[i + 1].pause) { groups.push({ type: "pair", works: [it, items[i + 1]] }); i++; }
      else if (it.arrange === "margin-note") groups.push({ type: "note", works: [it], note: it.note });
      else groups.push({ type: "single", works: [it] });
    }
    return { id: id, kind: "story", title: title, titleEm: titleEm, kicker: kicker, note: note, arrangement: arrangement, works: works, groups: groups, cover: works[0] };
  }
  window.SITE = {
    name: "Habib Saleh", title: "Ordinary", titleEm: "things", kicker: "Photographs · Lebanon · 2023 – 2025",
    note: "Five stories from villages in the Lebanese hills, made while they were still there.",
    contact: "Prints and enquiries · hello@example.com",
    pages: [
      story("road", "The road", "in", "Spring 2025 · Three photographs", "The way up to the village, and what stands at its last turn.", "held",
        pick([["12", "alone", "", true], ["8", "margin-note", "A pine above the last turn of the village road."], ["2"]]), 1, "Most of what these photographs show is not rare. It is simply about to be gone."),
      story("looked", "He looked", "back", "December 2023 – 2025 · Three photographs", "One man, met twice, two years apart.", "book",
        pick([["5", "alone", "", true], ["3", "with-next"], ["4"]])),
      story("gate", "Through the", "gate", "November 2025 · Three photographs", "Courtyards, gates and the things kept behind them.", "passage",
        pick([["10"], ["7", "with-next"], ["11"]])),
      story("afternoon", "Afternoon, the", "street", "Summer 2025 · Two photographs", "Children, trees and the hour when nothing is asked of anyone.", "held",
        pick([["1", "alone", "", true], ["6"]])),
      story("light", "Late", "light", "Autumn 2025 · Three photographs", "Walls and leaves in the last hour of sun.", "contact",
        pick([["9"], ["6"], ["7"]])),
      { id: "door", kind: "writing", title: "The door", titleEm: "remembers", kicker: "A poem · Beirut, 2026", image: byFile["9"],
        text: "The door remembers\nthe shape of every leaving:\na hand, a weight, the small\nhesitation before the latch.\n\nIt keeps no names.\nIt keeps the draught\nthat followed you out,\nand the light that did not." },
      { id: "about", kind: "about", title: "About", paras: ["Habib Saleh photographs and makes films. These stories were made over two years, on visits to villages in Lebanon, in the light of ordinary afternoons.", "The photographs are available as prints and as a short film."] },
      { id: "contact", kind: "contact", title: "Contact", paras: ["Prints, exhibitions and enquiries: hello@example.com.", "Studio visits by appointment, in Beirut."] }
    ],
    esc: S.esc
  };
  window.SITE.stories = window.SITE.pages.filter(function (p) { return p.kind === "story"; });
})();
