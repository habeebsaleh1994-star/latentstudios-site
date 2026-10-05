import { uid } from "./ids";
import type { Page, Site, CompositionSection } from "./model";
import { appliesTo, intentionErrors, type Intention } from "./intentions";
import { withSections } from "./compositionOrder";
import { keepStudy } from "./compositionStudies";
import { typeFor } from "./typography";
export type RelationshipScope = Intention["scope"];
export type RelationshipRequest = {
  image: string;
  text: string;
  scope: RelationshipScope;
  together: boolean;
  follows: boolean;
  remember: boolean;
  locked: string[];
};
export type RelationshipCandidate = {
  id: string;
  name: string;
  note: string;
  page: Page;
};
export const scopeLabel = (s: RelationshipScope) =>
  s === "both"
    ? "Desktop + phone"
    : s === "mobile"
      ? "Phone only"
      : "Desktop only";
export const devicesFor = (s: RelationshipScope): ("desktop" | "mobile")[] =>
  s === "both" ? ["desktop", "mobile"] : [s];
const pairMatches = (r: Intention, q: RelationshipRequest) =>
  [r.from, r.to].includes(q.image) && [r.from, r.to].includes(q.text);
/** Replace only this pair's selected-device intentions; preserve an unaffected half of a both-device rule. */
export function explorationIntentions(
  page: Page,
  q: RelationshipRequest,
): Intention[] {
  const rules = (page.intentions ?? []).flatMap((r) => {
    if (!pairMatches(r, q)) return [r];
    if (q.scope === "both") return [];
    if (r.scope === q.scope) return [];
    return [
      r.scope === "both"
        ? {
            ...r,
            scope:
              q.scope === "desktop"
                ? ("mobile" as const)
                : ("desktop" as const),
          }
        : r,
    ];
  });
  for (const kind of ["together", "follows"] as const)
    if (q[kind])
      rules.push({
        id:
          page.intentions?.find(
            (r) => pairMatches(r, q) && r.kind === kind && r.scope === q.scope,
          )?.id ?? uid(),
        kind,
        from: q.image,
        to: q.text,
        scope: q.scope,
      });
  return rules;
}
export function violatedIntentions(
  page: Page,
  rules: Intention[],
  device: "desktop" | "mobile",
) {
  const sections = page.composition?.[device] ?? [],
    order = sections.flatMap((s) => s.blockIds);
  return rules
    .filter((r) => appliesTo(r, device))
    .flatMap((r) => {
      if (
        r.kind === "together" &&
        !sections.some(
          (s) => s.blockIds.includes(r.from) && s.blockIds.includes(r.to),
        )
      )
        return [
          `${device === "mobile" ? "Phone" : "Desktop"}: a remembered together intention would be separated.`,
        ];
      if (
        r.kind === "follows" &&
        order.indexOf(r.to) !== order.indexOf(r.from) + 1
      )
        return [
          `${device === "mobile" ? "Phone" : "Desktop"}: a remembered immediate reading order cannot be retained.`,
        ];
      return [];
    });
}
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
function heldSignature(page: Page, id: string, device: "desktop" | "mobile") {
  const sections = page.composition?.[device] ?? [];
  const s = sections.find((s) => s.blockIds.includes(id));
  // A hold is intentionally conservative: peers, section position, reading order and presentation all matter.
  return JSON.stringify([
    sections.findIndex((s) => s.blockIds.includes(id)),
    s,
  ]);
}
export function proposeRelationships(
  site: Site,
  page: Page,
  q: RelationshipRequest,
  imageRatio: number,
): { candidates: RelationshipCandidate[]; reasons: string[] } {
  const image = page.blocks.find((b) => b.id === q.image),
    text = page.blocks.find((b) => b.id === q.text);
  const rules = explorationIntentions(page, q),
    errors = intentionErrors(
      rules,
      page.blocks.map((b) => b.id),
    );
  if (rules.length > 32)
    errors.push(
      "This page already holds 32 intentions. Remove an intention before remembering another.",
    );
  if (!image || image.type !== "image" || !text || text.type !== "text")
    errors.push("Choose one existing image and one writing work on this page.");
  if (!page.composition?.enabled)
    errors.push("Arrange this page before exploring a relationship.");
  if (!q.together && !q.follows)
    errors.push(
      "Choose Together or Text follows image to guide this exploration.",
    );
  if (!Number.isFinite(imageRatio) || imageRatio <= 0)
    errors.push(
      "The original image must load before alternatives can be measured.",
    );
  if (q.locked.some((id) => !page.blocks.some((b) => b.id === id)))
    errors.push(
      "A placement hold names a missing work. Start the exploration again.",
    );
  if (errors.length) return { candidates: [], reasons: [...new Set(errors)] };
  const candidates: RelationshipCandidate[] = [],
    reasons: string[] = [];
  const options = [
    {
      id: "balance",
      name: "In conversation",
      note: "Shared presence. Image proportions set the balance; writing keeps its own measure.",
    },
    {
      id: "emphasis",
      name: "The image leads",
      note: "A larger image and a quieter companion. On phone, a broad opening with a generous pause.",
    },
    {
      id: "sequence",
      name: "A reading sequence",
      note: "One work after the other, in a narrower column with room to read.",
    },
  ];
  for (const option of options) {
    let next = page;
    const blocked: string[] = [];
    for (const device of devicesFor(q.scope)) {
      const sections = next.composition![device],
        affected = sections.filter(
          (s) => s.blockIds.includes(q.image) || s.blockIds.includes(q.text),
        );
      const ids = affected.flatMap((s) => s.blockIds);
      if (ids.length > 4) {
        blocked.push(
          "This exploration can hold at most four works. Separate the pair from larger groups first.",
        );
        continue;
      }
      const indexes = affected.map((s) => sections.indexOf(s));
      if (Math.max(...indexes) - Math.min(...indexes) + 1 !== indexes.length) {
        blocked.push(
          `${device}: another section lies between this pair. Move the sections next to each other first.`,
        );
        continue;
      }
      if (affected.length > 1 && affected.some((s) => s.spatial?.enabled)) {
        blocked.push(
          `${device}: preview and apply Flow before joining freely placed sections. Their original placement will remain as a study.`,
        );
        continue;
      }
      if (q.follows) {
        ids.splice(ids.indexOf(q.text), 1);
        ids.splice(ids.indexOf(q.image) + 1, 0, q.text);
      }
      const first = affected[0],
        mobile = device === "mobile",
        type = typeFor(site, text!, mobile);
      const balance = clamp(
        Math.round(
          50 +
            Math.log2(
              image!.fit === "landscape"
                ? 1.5
                : image!.fit === "portrait"
                  ? 0.75
                  : imageRatio,
            ) *
              10,
        ),
        40,
        62,
      );
      const ratio =
        option.id === "emphasis"
          ? clamp(balance + 16, 56, text!.text.length > 1200 ? 64 : 78)
          : balance;
      const width = mobile
        ? option.id === "balance"
          ? 90
          : option.id === "emphasis"
            ? 100
            : 78
        : option.id === "sequence"
          ? clamp(Math.round((type.measure ?? 52) * 1.4), 64, 90)
          : 100;
      const section: CompositionSection = {
        ...first,
        blockIds: ids,
        layout: mobile || option.id === "sequence" ? "stack" : "columns",
        width: mobile ? "full" : "wide",
        widthPercent: width,
        columnRatio: ratio,
        align: "center",
        vertical: option.id === "emphasis" ? "center" : "start",
        gap: mobile
          ? option.id === "emphasis"
            ? 48
            : option.id === "sequence"
              ? 36
              : 24
          : option.id === "sequence"
            ? 56
            : 32,
        captions: affected.flatMap((s) => s.captions ?? []),
      };
      if (section.spatial)
        section.spatial = { ...section.spatial, enabled: false };
      next = withSections(
        next,
        sections.flatMap((s) =>
          s === first ? [section] : affected.includes(s) ? [] : [s],
        ),
        mobile,
      );
      blocked.push(...violatedIntentions(next, rules, device));
      if (
        q.locked.some(
          (id) =>
            heldSignature(page, id, device) !== heldSignature(next, id, device),
        )
      )
        blocked.push(
          `${device === "mobile" ? "Phone" : "Desktop"}: keeping the current placement conflicts with ${option.name.toLowerCase()}. Clear the placement hold or keep the draft.`,
        );
    }
    if (blocked.length) {
      reasons.push(...blocked);
      continue;
    }
    next = { ...next, ...(q.remember ? { intentions: rules } : {}) };
    const signature = JSON.stringify(next.composition);
    if (
      candidates.some((c) => JSON.stringify(c.page.composition) === signature)
    )
      continue;
    candidates.push({ ...option, page: next });
  }
  return { candidates, reasons: [...new Set(reasons)] };
}
/** Recompute at application; stale previews never replace newer words, assets or geometry. */
export function applyRelationshipCandidate(
  site: Site,
  page: Page,
  source: Page,
  q: RelationshipRequest,
  ratio: number,
  id: string,
): Page {
  if (JSON.stringify(page) !== JSON.stringify(source))
    throw Error(
      "This page changed while you explored. Close and explore the current content again.",
    );
  const candidate = proposeRelationships(site, page, q, ratio).candidates.find(
    (c) => c.id === id,
  );
  if (!candidate)
    throw Error(
      "This arrangement no longer satisfies the selected intentions.",
    );
  const kept = keepStudy(page, "Before relationship exploration");
  return { ...candidate.page, studies: kept.studies };
}
