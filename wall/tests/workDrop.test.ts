import { describe, it, expect } from "vitest";
import { initialSite, blankBlock, siteSchema, type Page } from "../src/model";
import { sectionFor } from "../src/composition";
import { readingOrder } from "../src/regrouping";
import { needsGroupingReview, planWorkDrop } from "../src/workDrop";
const source = (): Page => ({
  ...structuredClone(initialSite.pages.find((p) => p.id === "quiet")!),
  blocks: ["a", "b", "c", "d"].map((id, i) => ({
    ...blankBlock(i === 1 ? "text" : "image"),
    id,
    text: i === 1 ? "Original words" : "",
    assetId: i === 1 ? "" : "formBlue",
    caption: `Caption ${id}`,
    focal: { x: 13, y: 81 },
  })),
  composition: {
    enabled: true,
    desktop: ["a", "b", "c", "d"].map((id) => sectionFor([id], id)),
    mobile: ["a", "b", "d", "c"].map((id) =>
      sectionFor([id], `phone-${id}`, true),
    ),
  },
});
describe("explicit work drop policy", () => {
  it("groups separate image and text directly without changing either complete reading order or content", () => {
    const p = source(),
      plan = planWorkDrop(
        p,
        ["a", "b"],
        { kind: "into", sectionId: "b" },
        false,
        "pair",
      );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.review).toBe(false);
    expect(plan.page.blocks).toBe(p.blocks);
    expect(readingOrder(plan.page)).toEqual(readingOrder(p));
    expect(readingOrder(plan.page, true)).toEqual(readingOrder(p, true));
    expect(
      siteSchema.safeParse({
        ...initialSite,
        pages: [initialSite.pages[0], plan.page],
      }).success,
    ).toBe(true);
  });
  it("includes the whole target group and asks for review only when old unselected companions resize", () => {
    const p = source();
    p.composition!.desktop = [
      sectionFor(["a", "b"], "pair"),
      ...p.composition!.desktop.slice(2),
    ];
    const partial = planWorkDrop(
      p,
      ["b"],
      { kind: "into", sectionId: "c" },
      false,
      "bc",
    );
    expect(partial.ok && partial.review).toBe(true);
    const whole = planWorkDrop(
      p,
      ["c"],
      { kind: "into", sectionId: "pair" },
      false,
      "abc",
    );
    expect(whole.ok && whole.ids).toEqual(["a", "b", "c"]);
    expect(whole.ok && whole.review).toBe(false);
  });
  it("moves selected whole sections on desktop while retaining an authored phone order, IDs, crops and geometry", () => {
    const p = source(),
      plan = planWorkDrop(
        p,
        ["a", "b"],
        { kind: "between", beforeId: "d" },
        false,
      );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(readingOrder(plan.page)).toEqual(["c", "a", "b", "d"]);
    expect(readingOrder(plan.page, true)).toEqual(readingOrder(p, true));
    expect(plan.page.blocks.every((b) => p.blocks.includes(b))).toBe(true);
    expect(
      plan.page.composition!.desktop.every((s) =>
        p.composition!.desktop.includes(s),
      ),
    ).toBe(true);
  });
  it("moves phone order only and retains desktop geometry exactly", () => {
    const p = source(),
      plan = planWorkDrop(
        p,
        ["a", "b"],
        { kind: "between", beforeId: null },
        true,
      );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(readingOrder(plan.page, true)).toEqual(["d", "c", "a", "b"]);
    expect(plan.page.blocks).toBe(p.blocks);
    expect(plan.page.composition!.desktop).toBe(p.composition!.desktop);
  });
  it("refuses a desktop gap but permits desktop grouping across interleaved phone order", () => {
    const p = source(),
      original = structuredClone(p);
    expect(
      planWorkDrop(p, ["a"], { kind: "into", sectionId: "c" }, false).ok,
    ).toBe(false);
    expect(
      planWorkDrop(p, ["b"], { kind: "into", sectionId: "c" }, false).ok,
    ).toBe(true);
    expect(p).toEqual(original);
  });
  it("refuses stale, duplicate, partial-group and no-op between drops", () => {
    const p = source();
    expect(
      planWorkDrop(p, ["missing"], { kind: "between", beforeId: null }, false)
        .ok,
    ).toBe(false);
    expect(
      planWorkDrop(p, ["a", "a"], { kind: "between", beforeId: null }, false)
        .ok,
    ).toBe(false);
    expect(
      planWorkDrop(p, ["a"], { kind: "between", beforeId: "b" }, false).ok,
    ).toBe(false);
    expect(
      planWorkDrop(p, ["a"], { kind: "into", sectionId: "missing" }, false).ok,
    ).toBe(false);
    p.composition!.desktop = [
      sectionFor(["a", "b"], "pair"),
      ...p.composition!.desktop.slice(2),
    ];
    expect(
      planWorkDrop(p, ["a"], { kind: "between", beforeId: null }, false).ok,
    ).toBe(false);
  });
  it("keeps review for partial multi-companion separations and directly separates complete groups", () => {
    const p = source();
    p.composition!.desktop = [
      sectionFor(["a", "b", "c"], "trio"),
      p.composition!.desktop[3],
    ];
    expect(needsGroupingReview(p, ["b"], "separate")).toBe(true);
    expect(needsGroupingReview(p, ["a", "b", "c"], "separate")).toBe(false);
  });
});
