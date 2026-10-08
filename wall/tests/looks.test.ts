import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { lookIds } from "../src/studio/site";

/* The design guard: whatever look an artist picks, the words stay readable. */
type Look = { name: string; scheme?: string; vars?: Record<string, string> };
type Theme = { accentFor: (look: string, chosen: string | null, dark: boolean, palette: string) => { peony: string; text: string; on: string; ground: string }; fit: (a: string, g: string, i: string, n?: number) => string; looksFor: (t: string) => string[]; LOOKS: Record<string, Look & { only?: string[] }>; PALETTES: Record<string, { light: Record<string, string>; dark: Record<string, string> }>; contrast: (a: string, b: string) => number };
const win: { FolioTheme?: Theme } = {};
runInNewContext(readFileSync("design/shared/theme.js", "utf8"), { window: win, document: {}, matchMedia: () => ({ matches: false }) });
const T = win.FolioTheme!;

const grounds = Object.entries(T.LOOKS).filter(([, l]) => l.vars).map(([id, l]) => ({ id, v: l.vars! }));
const resolve = (v: Record<string, string>, k: string) => {
  if (v[k] === "var(--peony-text)") return T.fit(v["--peony"], v["--silk"], v["--ink"], 4.6);
  return v[k].startsWith("var(") ? v[v[k].slice(4, -1)] : v[k];
};

describe("every look stays readable", () => {
  it("has exactly the looks the document allows", () => {
    expect(Object.keys(T.LOOKS).sort()).toEqual([...lookIds].sort());
  });
  it("offers each template the shared looks plus the ones made only for it", () => {
    const shared = Object.keys(T.LOOKS).filter((k) => !T.LOOKS[k].only);
    for (const t of ["folio", "index", "salon", "reel", "atelier", "lantern"]) {
      const mine = Object.keys(T.LOOKS).filter((k) => T.LOOKS[k].only?.includes(t));
      expect(mine.length, `${t} has an exclusive look`).toBeGreaterThan(0);
      expect(T.looksFor(t).sort()).toEqual([...shared, ...mine].sort());
    }
    expect(T.looksFor("folio")).not.toContain("cinema");
  });
  for (const { id, l } of Object.entries(T.LOOKS).filter(([, l]) => l.vars).map(([id, l]) => ({ id, l: l as Look & { night?: Record<string, string>; day?: Record<string, string> } }))) {
    it(`${id}: has its other half (${l.scheme === "dark" ? "a day" : "a night"}), and it reads as well`, () => {
      const half = l.scheme === "dark" ? l.day : l.night; expect(half, `${id} needs a ${l.scheme === "dark" ? "day" : "night"}`).toBeTruthy();
      const v = { ...l.vars!, ...half! };
      expect(T.contrast(v["--ink"], v["--silk"])).toBeGreaterThanOrEqual(7);
      expect(T.contrast(v["--ink-soft"], v["--silk"])).toBeGreaterThanOrEqual(4.5);
      expect(T.contrast(v["--ink-soft"], v["--silk-deep"])).toBeGreaterThanOrEqual(4.5);
      expect(T.contrast(T.fit(v["--peony"], v["--silk"], v["--ink"], 4.6), v["--silk"])).toBeGreaterThanOrEqual(4.5);
      // the other half is the same art direction with the lights changed: its ground is on the other side of mid-grey
      const lum = (h: string) => T.contrast(h, "#000000"); const wasDark = lum(l.vars!["--silk"]) < 5, isDark = lum(v["--silk"]) < 5; expect(isDark).toBe(!wasDark);
    });
  }
  for (const { id, v } of grounds) {
    it(`${id}: body text is at least 7:1, small secondary text at least 4.5:1`, () => {
      expect(T.contrast(v["--ink"], v["--silk"])).toBeGreaterThanOrEqual(7);
      expect(T.contrast(v["--ink-soft"], v["--silk"])).toBeGreaterThanOrEqual(4.5);
      expect(T.contrast(v["--ink-soft"], v["--silk-deep"])).toBeGreaterThanOrEqual(4.5);
    });
    it(`${id}: small accent text can be made readable (4.5:1), and text on an accent fill reads too`, () => {
      expect(T.contrast(T.fit(v["--peony"], v["--silk"], v["--ink"], 4.6), v["--silk"])).toBeGreaterThanOrEqual(4.5);
      if (["swiss", "soft", "zine"].includes(id)) expect(T.contrast(id === "zine" ? v["--ink"] : v["--silk"], v["--peony"])).toBeGreaterThanOrEqual(4.5);
    });
    it(`${id}: the accent works for large type (3:1) and its text colour does too`, () => {
      expect(T.contrast(v["--peony"], v["--silk"])).toBeGreaterThanOrEqual(3);
      expect(T.contrast(resolve(v, "--em-color"), v["--silk"])).toBeGreaterThanOrEqual(3);
    });
  }
  it("the quiet palettes pass the same bar, day and night", () => {
    for (const [id, p] of Object.entries(T.PALETTES))
      for (const mode of ["light", "dark"] as const) {
        expect(T.contrast(p[mode].ink, p[mode].silk), `${id} ${mode} ink`).toBeGreaterThanOrEqual(7);
        expect(T.contrast(p[mode].soft, p[mode].silk), `${id} ${mode} soft`).toBeGreaterThanOrEqual(4.5);
      }
  });
});

describe("the artist's accent works in every look and stays readable", () => {
  /* deliberately awkward: very light, very dark, very bright, grey, and the old default */
  const accents = ["#FFD400", "#1B2A6B", "#FF2D95", "#00C2A8", "#FFFFFF", "#000000", "#888888", "#B87B8A", "#7CFC00"];
  const fills: Record<string, boolean> = { swiss: true, soft: true, zine: true };
  for (const id of Object.keys(T.LOOKS)) {
    for (const a of accents) {
      it(`${id} with ${a}: it reads on the ground, small text reads, and text on an accent fill reads`, () => {
        const dark = T.LOOKS[id].scheme === "dark";
        const r = T.accentFor(id, a, dark, "silk");
        expect(T.contrast(r.peony, r.ground), "accent on ground").toBeGreaterThanOrEqual(3);
        expect(T.contrast(r.text, r.ground), "small accent text").toBeGreaterThanOrEqual(4.5);
        if (fills[id]) expect(T.contrast(r.on, r.peony), "text on the accent fill").toBeGreaterThanOrEqual(4.5);
      });
    }
    it(`${id} with no choice uses its own accent unchanged`, () => {
      const l = T.LOOKS[id]; if (!l.vars) return;
      expect(T.accentFor(id, null, l.scheme === "dark", "silk").peony.toLowerCase()).toBe(l.vars["--peony"].toLowerCase());
    });
  }
  it("a chosen accent changes the result in every look, not only the quiet one", () => {
    for (const id of Object.keys(T.LOOKS)) {
      const own = T.accentFor(id, null, T.LOOKS[id].scheme === "dark", "silk").peony, picked = T.accentFor(id, "#2F6FEB", T.LOOKS[id].scheme === "dark", "silk").peony;
      expect(picked.toLowerCase(), id).not.toBe(own.toLowerCase());
    }
  });
});
