import type { CSSProperties } from "react";
import type { Site, Identity } from "./model";
export const fonts = {
  serif: {
    label: "Literary serif",
    stack: 'Georgia, "Times New Roman", serif',
  },
  sans: { label: "Clear sans", stack: "Arial, Helvetica, sans-serif" },
  humanist: {
    label: "Book humanist",
    stack: '"Palatino Linotype", Palatino, "Book Antiqua", serif',
  },
  mono: { label: "Studio mono", stack: '"Courier New", Courier, monospace' },
};
export const palettes = [
  {
    name: "Chalk & graphite",
    canvas: "#f7f5ef",
    ink: "#262825",
    accent: "#485b3d",
  },
  {
    name: "Cobalt & porcelain",
    canvas: "#f0f0e8",
    ink: "#132c8a",
    accent: "#bd3b27",
  },
  {
    name: "Plum & parchment",
    canvas: "#eee4d5",
    ink: "#482c42",
    accent: "#753c34",
  },
  {
    name: "Carbon & citron",
    canvas: "#151a1a",
    ink: "#f3f0df",
    accent: "#dfef80",
  },
];
const themes = {
  paper: { canvas: "#f6f3ec", ink: "#292d29" },
  white: { canvas: "#ffffff", ink: "#232724" },
  ink: { canvas: "#252c29", ink: "#ece8dc" },
};
export function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const rgb = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function suggestedInk(canvas: string) {
  return contrast(canvas, "#202420") > contrast(canvas, "#faf9f2")
    ? "#202420"
    : "#faf9f2";
}
export function colorsFor(site: Site) {
  const a = site.appearances[site.styleId],
    base = themes[a.theme];
  return {
    canvas: a.identity.canvas ?? base.canvas,
    ink: a.identity.ink ?? base.ink,
    accent: a.identity.accent ?? base.ink,
  };
}
export function patchIdentity(site: Site, patch: Partial<Identity>): Site {
  const id = site.styleId;
  return {
    ...site,
    appearances: {
      ...site.appearances,
      [id]: {
        ...site.appearances[id],
        identity: { ...site.appearances[id].identity, ...patch },
      },
    },
  };
}
export function copyIdentityToAll(site: Site): Site {
  const a = site.appearances[site.styleId];
  return {
    ...site,
    appearances: Object.fromEntries(
      Object.entries(site.appearances).map(([id, v]) => [
        id,
        {
          ...v,
          theme: a.theme,
          typography: a.typography,
          identity: { ...a.identity },
        },
      ]),
    ) as Site["appearances"],
  };
}
export function identityTokens(site: Site): CSSProperties {
  const a = site.appearances[site.styleId],
    i = a.identity,
    c = colorsFor(site);
  const heading =
    i.headingFont === "style"
      ? a.typography === "editorial"
        ? "serif"
        : "sans"
      : i.headingFont;
  const body =
    i.bodyFont === "style"
      ? a.typography === "editorial"
        ? "serif"
        : "sans"
      : i.bodyFont;
  return {
    "--identity-paper": c.canvas,
    "--identity-ink": c.ink,
    "--identity-accent": c.accent,
    "--heading-font": fonts[heading].stack,
    "--body-font": fonts[body].stack,
    "--heading-scale": i.headingScale / 100,
    "--body-scale": i.bodyScale / 100,
    "--heading-weight": i.weight,
    "--heading-tracking": `${i.tracking / 100}em`,
    "--identity-leading": i.leading,
    "--identity-image-scale": `${i.imageScale}%`,
    "--identity-margin": i.margin === null ? undefined : `${i.margin}vw`,
    "--identity-alignment": i.alignment === "style" ? undefined : i.alignment,
  } as CSSProperties;
}
