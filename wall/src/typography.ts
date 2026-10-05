import type { CSSProperties } from "react";
import type {
  Site,
  Block,
  BlockTypography,
  TypeOverrides,
  TextStyle,
} from "./model";
import { fonts } from "./identity";
import { uid } from "./ids";
export type WritingTarget = { pageId: string; blockId: string };
export const inheritedTypography = (): BlockTypography => ({
  styleId: null,
  base: {},
  mobile: {},
});
export function typeFor(
  site: Site,
  block: Block,
  mobile = false,
): TypeOverrides {
  const t = block.typography,
    style = site.textStyles.find((s) => s.id === t?.styleId);
  return {
    ...style?.base,
    ...(mobile ? style?.mobile : {}),
    ...t?.base,
    ...(mobile ? t?.mobile : {}),
  };
}
export function typeCSS(t: TypeOverrides): CSSProperties | undefined {
  if (!Object.keys(t).length) return undefined;
  return {
    fontFamily: t.font ? fonts[t.font].stack : undefined,
    fontSize: t.size === undefined ? undefined : `${t.size}px`,
    lineHeight: t.leading,
    letterSpacing: t.tracking === undefined ? undefined : `${t.tracking}em`,
    textAlign: t.align,
    maxWidth: t.measure === undefined ? undefined : `min(100%, ${t.measure}ch)`,
    whiteSpace:
      t.flow === "poem"
        ? "pre-wrap"
        : t.flow === "prose"
          ? "pre-line"
          : undefined,
    textTransform: "none",
  };
}
export function changeTypography(
  site: Site,
  target: WritingTarget,
  fn: (t: BlockTypography) => BlockTypography | undefined,
): Site {
  return {
    ...site,
    pages: site.pages.map((p) =>
      p.id !== target.pageId
        ? p
        : {
            ...p,
            blocks: p.blocks.map((b) => {
              if (b.id !== target.blockId || b.type !== "text") return b;
              const next = fn(b.typography ?? inheritedTypography());
              const { typography, ...rest } = b;
              void typography;
              return next ? { ...rest, typography: next } : rest;
            }),
          },
    ),
  };
}
export const styleUsers = (site: Site, id: string) =>
  site.pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "text" && b.typography?.styleId === id).length;
export function patchType(
  site: Site,
  target: WritingTarget,
  styleId: string | null,
  mobile: boolean,
  key: keyof TypeOverrides,
  value: TypeOverrides[keyof TypeOverrides] | undefined,
): Site {
  const patch = (prior: TypeOverrides) => {
    const next = { ...prior, [key]: value };
    if (value === undefined) delete next[key];
    return next;
  };
  const layer = mobile ? "mobile" : "base";
  return styleId
    ? {
        ...site,
        textStyles: site.textStyles.map((s) =>
          s.id === styleId ? { ...s, [layer]: patch(s[layer]) } : s,
        ),
      }
    : changeTypography(site, target, (t) => ({
        ...t,
        [layer]: patch(t[layer]),
      }));
}
export const rolePresets: Record<TextStyle["role"], TypeOverrides> = {
  poem: {
    font: "serif",
    size: 24,
    leading: 1.65,
    tracking: 0,
    align: "start",
    measure: 38,
    flow: "poem",
  },
  statement: {
    font: "sans",
    size: 20,
    leading: 1.7,
    tracking: 0,
    align: "start",
    measure: 58,
    flow: "prose",
  },
  note: {
    font: "mono",
    size: 14,
    leading: 1.6,
    tracking: 0.02,
    align: "start",
    measure: 34,
    flow: "prose",
  },
  custom: {},
};
export function createTextStyle(
  site: Site,
  target: WritingTarget,
  name: string,
  role: TextStyle["role"],
  id = uid(),
): Site {
  const style: TextStyle = {
    id,
    name: name.trim(),
    role,
    base: { ...rolePresets[role] },
    mobile: {},
  };
  return changeTypography(
    { ...site, textStyles: [...site.textStyles, style] },
    target,
    () => ({ styleId: id, base: {}, mobile: {} }),
  );
}
export function typographyAdvice(t: TypeOverrides) {
  const notes: string[] = [];
  if (t.size !== undefined && t.size < 14)
    notes.push("Small reading text: review at actual phone size.");
  if (t.leading !== undefined && t.leading < 1.2)
    notes.push("Tight line spacing may make long writing harder to read.");
  if (t.measure !== undefined && (t.measure < 20 || t.measure > 85))
    notes.push("This line measure is unusual for sustained reading.");
  if (t.tracking !== undefined && Math.abs(t.tracking) > 0.15)
    notes.push("Strong tracking can make words harder to recognize.");
  return notes;
}
