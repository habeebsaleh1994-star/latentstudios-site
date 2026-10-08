/*
 * Colour from the work. The artist's own photographs, read for the few colours that would hold as an
 * accent: distinct, with some saturation, neither the paper nor the shadows. Offered beside the
 * curated accents; the look's own fitting then makes each one read on its ground.
 */
export type Swatch = { hex: string; weight: number };

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
function hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
/** How far apart two colours feel, on hue, saturation and lightness together. */
function apart(a: [number, number, number], b: [number, number, number]) {
  const dh = Math.min(Math.abs(a[0] - b[0]), 360 - Math.abs(a[0] - b[0])) / 180;
  return Math.sqrt(dh * dh * 3 + (a[1] - b[1]) ** 2 * 0.5 + (a[2] - b[2]) ** 2 * 1.0);
}

/**
 * The accent-worthy colours in a picture, strongest first. Pixels are binned coarsely by hue, saturation and
 * lightness; bins too pale, too dark or too grey to carry an accent are left out; near-duplicates are merged.
 */
export function accentsFrom(px: Uint8ClampedArray, count = 4): Swatch[] {
  const bins = new Map<string, { n: number; r: number; g: number; b: number }>();
  const step = Math.max(1, Math.floor(px.length / 4 / 20000)); // at most ~20k samples
  for (let i = 0; i < px.length; i += 4 * step) {
    const r = px[i], g = px[i + 1], b = px[i + 2], [h, s, l] = hsl(r, g, b);
    if (s < 0.22 || l < 0.16 || l > 0.82) continue;
    const key = `${Math.round(h / 20)}:${Math.round(s * 5)}:${Math.round(l * 6)}`;
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }; bin.n++; bin.r += r; bin.g += g; bin.b += b; bins.set(key, bin);
  }
  const all = [...bins.values()].map((x) => ({ r: x.r / x.n, g: x.g / x.n, b: x.b / x.n, n: x.n }))
    .map((x) => ({ ...x, h: hsl(x.r, x.g, x.b), score: x.n * (0.6 + hsl(x.r, x.g, x.b)[1]) }))
    .sort((a, b) => b.score - a.score);
  const picked: typeof all = [];
  for (const c of all) { if (picked.every((p) => apart(p.h, c.h) > 0.25)) picked.push(c); if (picked.length >= count) break; }
  const total = all.reduce((a, c) => a + c.n, 0) || 1;
  return picked.map((c) => ({ hex: hex(c.r, c.g, c.b), weight: Math.round((c.n / total) * 1000) / 1000 }));
}

/** The accents across a body of work: each picture's strongest colours, merged, the ones that recur first. */
export function accentsAcross(perImage: Swatch[][], count = 6): string[] {
  const seen: { hex: string; h: [number, number, number]; weight: number; images: number }[] = [];
  for (const sw of perImage) for (const s of sw) {
    const rgb = [1, 3, 5].map((i) => parseInt(s.hex.slice(i, i + 2), 16)) as [number, number, number], h = hsl(...rgb);
    const near = seen.find((x) => apart(x.h, h) < 0.2);
    if (near) { near.weight += s.weight; near.images++; } else seen.push({ hex: s.hex, h, weight: s.weight, images: 1 });
  }
  return seen.sort((a, b) => b.images * 0.5 + b.weight - (a.images * 0.5 + a.weight)).slice(0, count).map((x) => x.hex);
}

/** A picture's pixels, small, from a drawn image (the browser side; not used in tests). */
export async function pixelsOf(src: string, size = 96): Promise<Uint8ClampedArray | null> {
  try {
    const img = new Image(); img.decoding = "async"; img.src = src; await img.decode();
    const r = img.naturalWidth / img.naturalHeight, w = r >= 1 ? size : Math.round(size * r), h = r >= 1 ? Math.round(size / r) : size;
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d", { willReadFrequently: true })!; g.drawImage(img, 0, 0, w, h);
    return g.getImageData(0, 0, w, h).data;
  } catch { return null; }
}
