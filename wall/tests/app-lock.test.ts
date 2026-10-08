import { describe, it, expect } from "vitest";
import { seal, open } from "../src/app/lock";

describe("a page behind a word", () => {
  it("seals and opens with the word; a wrong word opens nothing; nothing readable is left", async () => {
    const s = await seal("<main>The road in, Joun</main>", "olive tree");
    expect(JSON.stringify(s)).not.toMatch(/Joun|road/);
    expect(await open(s, "olive tree")).toBe("<main>The road in, Joun</main>");
    expect(await open(s, " Olive tree ".toLowerCase())).toBe("<main>The road in, Joun</main>"); // spaces around it are forgiven
    expect(await open(s, "olive")).toBeNull();
    const t = await seal("<main>The road in, Joun</main>", "olive tree");
    expect(t.data).not.toBe(s.data); // a fresh salt and iv each time
  });
});
