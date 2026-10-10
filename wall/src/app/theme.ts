/*
 * Applying a site's theme: the look (theme.js, shared with the old templates) and, over it, the choices
 * Wall adds: the skeleton (header, opening, title, captions, footer, scale) and a typeface that can be
 * changed under any look. Each is a data attribute or a few variables; the CSS in app.css does the rest.
 */
import type { Theme } from "../studio/site";

type Legacy = { apply: (t: Record<string, unknown>) => void };
const L = () => (window as unknown as { FolioTheme: Legacy }).FolioTheme;

/** Twelve pairings, all loaded with the page. Display face, body face, label face, title weight. */
export const TYPEFACES: Record<NonNullable<Theme["typeface"]>, { name: string; note: string; display: string; body: string; label: string; weight: number }> = {
  newsreader: { name: "Newsreader", note: "A literary serif, light", display: '"Newsreader", "Newsreader Fallback", Georgia, serif', body: '"Newsreader", "Newsreader Fallback", Georgia, serif', label: '"Instrument Sans", "Instrument Sans Fallback", system-ui, sans-serif', weight: 300 },
  caslon: { name: "Caslon", note: "A book face of the 1700s", display: '"Libre Caslon Text", "Libre Caslon Text Fallback", Georgia, serif', body: '"Libre Caslon Text", "Libre Caslon Text Fallback", Georgia, serif', label: '"Karla", "Karla Fallback", system-ui, sans-serif', weight: 400 },
  instrument: { name: "Instrument", note: "A narrow display serif with a plain sans", display: '"Instrument Serif", "Instrument Serif Fallback", Georgia, serif', body: '"Instrument Sans", "Instrument Sans Fallback", system-ui, sans-serif', label: '"Instrument Sans", "Instrument Sans Fallback", system-ui, sans-serif', weight: 400 },
  archive: { name: "Archive", note: "A serif with typewriter labels", display: '"Newsreader", "Newsreader Fallback", Georgia, serif', body: '"Newsreader", "Newsreader Fallback", Georgia, serif', label: '"IBM Plex Mono", "IBM Plex Mono Fallback", ui-monospace, monospace', weight: 300 },
  bodoni: { name: "Bodoni", note: "High contrast, a fashion page", display: '"Bodoni Moda", "Bodoni Moda Fallback", Didot, Georgia, serif', body: '"Newsreader", "Newsreader Fallback", Georgia, serif', label: '"Instrument Sans", "Instrument Sans Fallback", system-ui, sans-serif', weight: 400 },
  fraunces: { name: "Fraunces", note: "A soft old-style serif with weight", display: '"Fraunces", "Fraunces Fallback", Georgia, serif', body: '"Fraunces", "Fraunces Fallback", Georgia, serif', label: '"DM Sans", "DM Sans Fallback", system-ui, sans-serif', weight: 400 },
  young: { name: "Young Serif", note: "A sturdy, friendly serif", display: '"Young Serif", "Young Serif Fallback", Georgia, serif', body: '"Jost", "Jost Fallback", system-ui, sans-serif', label: '"Jost", "Jost Fallback", system-ui, sans-serif', weight: 400 },
  archivo: { name: "Archivo", note: "A firm grotesque, set heavy", display: '"Archivo", "Archivo Fallback", system-ui, sans-serif', body: '"Archivo", "Archivo Fallback", system-ui, sans-serif', label: '"Archivo", "Archivo Fallback", system-ui, sans-serif', weight: 600 },
  grotesk: { name: "Grotesk", note: "A quiet modern sans", display: '"DM Sans", "DM Sans Fallback", system-ui, sans-serif', body: '"DM Sans", "DM Sans Fallback", system-ui, sans-serif', label: '"DM Sans", "DM Sans Fallback", system-ui, sans-serif', weight: 500 },
  jost: { name: "Jost", note: "A light geometric sans", display: '"Jost", "Jost Fallback", system-ui, sans-serif', body: '"Jost", "Jost Fallback", system-ui, sans-serif', label: '"Jost", "Jost Fallback", system-ui, sans-serif', weight: 300 },
  plex: { name: "Plex Mono", note: "Monospace throughout, a working file", display: '"IBM Plex Mono", "IBM Plex Mono Fallback", ui-monospace, monospace', body: '"IBM Plex Mono", "IBM Plex Mono Fallback", ui-monospace, monospace', label: '"IBM Plex Mono", "IBM Plex Mono Fallback", ui-monospace, monospace', weight: 400 },
  courier: { name: "Courier", note: "A typewritten page", display: '"Courier Prime", "Courier Prime Fallback", ui-monospace, monospace', body: '"Courier Prime", "Courier Prime Fallback", ui-monospace, monospace', label: '"Courier Prime", "Courier Prime Fallback", ui-monospace, monospace', weight: 400 },
};

export const STRUCTURE = {
  header: [["classic", "Name and menu"], ["centred", "Centred"], ["stacked", "Name above menu"], ["rail", "A side column"], ["name", "Name only"]],
  opening: [["words", "Words first"], ["image", "An image first"], ["name", "Your name"], ["work", "Straight into the work"]],
  title: [["accent", "An accented word"], ["plain", "One voice"], ["quiet", "Small and quiet"], ["caps", "Capitals"]],
  captions: [["under", "Under the work"], ["beside", "Beside it"], ["hover", "When pointed at"], ["hidden", "Hidden"]],
  footer: [["line", "A line"], ["large", "Your name, large"], ["minimal", "Almost nothing"]],
  scale: [["intimate", "Intimate"], ["standard", "Standard"], ["monumental", "Monumental"]],
} as const satisfies Record<string, readonly (readonly [string, string])[]>;
export const STRUCTURE_HINTS: Record<keyof typeof STRUCTURE, string> = {
  header: "Where your name and the menu sit on every page.",
  opening: "How the front page begins.",
  title: "How titles speak, on every page.",
  captions: "How a work's title and date sit with it.",
  footer: "The foot of every page.",
  scale: "How large works are held, and how much air is around them.",
};

export function applyTheme(t: Theme, house?: string) {
  L().apply({ ...t });
  const r = document.documentElement, d = r.dataset;
  d.header = t.header; d.opening = t.opening; d.title = t.title; d.captions = t.captions; d.footer = t.footer; d.scale = t.scale; if (house) d.house = house;
  if (t.typeface) {
    const f = TYPEFACES[t.typeface];
    r.style.setProperty("--serif", f.display); r.style.setProperty("--body", f.body); r.style.setProperty("--sans", f.label); r.style.setProperty("--title-weight", String(f.weight));
    d.typeface = t.typeface;
  } else delete d.typeface;
}
