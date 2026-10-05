import type { CaptionTreatment, CompositionSection } from "./model";
export function patchCaption(
  s: CompositionSection,
  id: string,
  patch: Partial<Omit<CaptionTreatment, "blockId">> | null,
): CompositionSection {
  const captions = (s.captions ?? []).filter((c) => c.blockId !== id);
  if (patch)
    captions.push({
      ...s.captions?.find((c) => c.blockId === id),
      ...patch,
      blockId: id,
    });
  const { captions: old, ...rest } = s;
  void old;
  return captions.length ? { ...rest, captions } : rest;
}
