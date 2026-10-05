import type { CompositionSection, SpatialFrame, SpatialLayout } from "./model";
export const round = (n: number) => Math.round(n * 10000) / 10000;
export const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));
export function boundFrame(f: SpatialFrame): SpatialFrame {
  const width = round(clamp(f.width, 10, 100));
  return {
    ...f,
    width,
    x: round(clamp(f.x, 0, 100 - width)),
    y: round(clamp(f.y, 0, 100000)),
  };
}
export function resizeFrame(f: SpatialFrame, width: number): SpatialFrame {
  return { ...f, width: round(clamp(width, 10, 100 - f.x)) };
}
export function reconcileSpatial(s: CompositionSection): CompositionSection {
  if (s.captions) {
    const captions = s.captions.filter((c) => s.blockIds.includes(c.blockId));
    if (captions.length !== s.captions.length) s = { ...s, captions };
  }
  if (!s.spatial) return s;
  const frames = s.spatial.frames.filter((f) => s.blockIds.includes(f.blockId));
  const layers = s.spatial.layers.filter((id) => s.blockIds.includes(id));
  for (const id of s.blockIds)
    if (!frames.some((f) => f.blockId === id)) {
      frames.push({ blockId: id, x: 0, y: 0, width: 100 });
      layers.push(id);
    }
  if (
    frames.length === s.spatial.frames.length &&
    layers.length === s.spatial.layers.length &&
    frames.every((f, i) => f === s.spatial!.frames[i]) &&
    layers.every((id, i) => id === s.spatial!.layers[i])
  )
    return s;
  return { ...s, spatial: { ...s.spatial, frames, layers } };
}
export function patchFrame(
  s: CompositionSection,
  id: string,
  fn: (f: SpatialFrame) => SpatialFrame,
): CompositionSection {
  return s.spatial
    ? {
        ...s,
        spatial: {
          ...s.spatial,
          frames: s.spatial.frames.map((f) =>
            f.blockId === id ? boundFrame(fn(f)) : f,
          ),
        },
      }
    : s;
}
export function layerWork(
  s: CompositionSection,
  id: string,
  delta: number,
): CompositionSection {
  if (!s.spatial) return s;
  const layers = [...s.spatial.layers],
    from = layers.indexOf(id),
    to = from + delta;
  if (from < 0 || to < 0 || to >= layers.length) return s;
  layers.splice(to, 0, layers.splice(from, 1)[0]);
  return { ...s, spatial: { ...s.spatial, layers } };
}
/** Sample current flow boxes. This is a conversion input, never a second saved layout. */
export function measureSpatial(
  section: HTMLElement,
  ids: string[],
): SpatialLayout {
  const stage = section.querySelector<HTMLElement>(
    ":scope > .composition-grid",
  )!;
  const images = [...stage.querySelectorAll("img")];
  images.forEach((image) => (image.loading = "eager"));
  if (
    images.some((image) => !image.complete || !image.naturalWidth) ||
    [...stage.querySelectorAll("video")].some((video) => video.readyState < 1)
  )
    throw Error(
      "The media is still loading. Try placement once it has appeared, so its proportions are preserved.",
    );
  const box = stage.getBoundingClientRect();
  const frames = ids.map((blockId) => {
    const work = [...stage.children].find(
      (el) => (el as HTMLElement).dataset.compositionBlock === blockId,
    )!;
    const r = work.getBoundingClientRect();
    return boundFrame({
      blockId,
      x: (100 * (r.left - box.left)) / box.width,
      y: r.top - box.top,
      width: (100 * r.width) / box.width,
    });
  });
  if (!box.width || box.height > 100000)
    throw Error(
      "This section is too tall for spatial placement. Keep it in flow or split it into smaller sections.",
    );
  return {
    enabled: true,
    minHeight: Math.ceil(box.height),
    frames,
    layers: [...ids],
  };
}
export type SpatialGuide = { axis: "x" | "y"; at: number; label: string };
export function snapFrame(
  next: SpatialFrame,
  others: SpatialFrame[],
  width: number,
  heights: Record<string, number>,
  resize = false,
): { frame: SpatialFrame; guides: SpatialGuide[] } {
  const guides: SpatialGuide[] = [],
    threshold = 600 / width;
  const xTargets = [
    { at: 0, label: "Edge" },
    { at: 50, label: "Centre" },
    { at: 100, label: "Edge" },
    ...others.flatMap((f) => [
      { at: f.x, label: "Aligned" },
      { at: f.x + f.width / 2, label: "Centres" },
      { at: f.x + f.width, label: "Aligned" },
    ]),
  ];
  const candidates = xTargets.flatMap((t) =>
    (resize
      ? [next.x + next.width]
      : [next.x, next.x + next.width / 2, next.x + next.width]
    ).map((v) => ({ delta: t.at - v, ...t })),
  );
  if (!resize)
    for (const left of others)
      for (const right of others) {
        if (
          left === right ||
          left.x + left.width > next.x + next.width / 2 ||
          right.x < next.x + next.width / 2
        )
          continue;
        const x = (left.x + left.width + right.x - next.width) / 2;
        if (x >= left.x + left.width && x + next.width <= right.x)
          candidates.push({ delta: x - next.x, at: x, label: "Equal gaps" });
      }
  candidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
  let frame = { ...next };
  if (candidates[0] && Math.abs(candidates[0].delta) <= threshold) {
    const c = candidates[0];
    frame = resize
      ? { ...frame, width: frame.width + c.delta }
      : { ...frame, x: frame.x + c.delta };
    guides.push({ axis: "x", at: c.at, label: c.label });
  }
  if (!resize) {
    const h = heights[next.blockId] ?? 0;
    const candidates = [
      { at: 0, label: "Top" },
      ...others.flatMap((f) => [
        { at: f.y, label: "Aligned" },
        { at: f.y + (heights[f.blockId] ?? 0), label: "Aligned" },
      ]),
    ].flatMap((t) =>
      [next.y, next.y + h].map((v) => ({ ...t, delta: t.at - v })),
    );
    for (const top of others)
      for (const bottom of others) {
        const end = top.y + (heights[top.blockId] ?? 0);
        if (top === bottom || end > next.y + h / 2 || bottom.y < next.y + h / 2)
          continue;
        const y = (end + bottom.y - h) / 2;
        if (y >= end && y + h <= bottom.y)
          candidates.push({ at: y, label: "Equal gaps", delta: y - next.y });
      }
    candidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
    if (candidates[0] && Math.abs(candidates[0].delta) <= 6) {
      const c = candidates[0];
      frame.y += c.delta;
      guides.push({ axis: "y", at: c.at, label: c.label });
    }
  }
  return { frame: boundFrame(frame), guides };
}
