import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { readMeta, inOrder, stamp, dateWord } from "../src/app/meta";

const buf = (f: string) => { const b = readFileSync(f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

describe("what a photograph's file says about itself", () => {
  it("reads the headline, the caption, the by-line and the moment taken from a Lightroom export", () => {
    const m = readMeta(buf("design/folio/img/7.jpg"));
    expect(m.title).toBe("Stray Cat in an Abandoned House");
    expect(m.caption).toMatch(/^A stray cat sits inside an abandoned house in Joun/);
    expect(m.byline).toBe("Habib Saleh");
    expect(m.taken).toBe("2025-11-10T16:32:42");
    expect(m.date).toBe("10 Nov 2025");
  });
  it("reads every sample photograph, and each has its own moment", () => {
    const takens = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((n) => readMeta(buf(`design/folio/img/${n}.jpg`)).taken);
    expect(takens.every(Boolean)).toBe(true);
    expect(new Set(takens).size).toBe(takens.length);
  });
  it("gives nothing for a file that is not a JPEG, and never throws", () => {
    expect(readMeta(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]).buffer)).toEqual({});
    expect(readMeta(new ArrayBuffer(0))).toEqual({});
    expect(readMeta(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x45]).buffer)).toEqual({});
  });
  it("orders a folder by the moment taken, then by name with numbers in order", () => {
    const o = inOrder([{ name: "b.jpg" }, { name: "IMG_10.jpg", taken: "2025-03-01T10:00:00" }, { name: "a.jpg" }, { name: "IMG_2.jpg", taken: "2025-01-01T10:00:00" }, { name: "IMG_9.jpg" }]);
    expect(o.map((x) => x.name)).toEqual(["IMG_2.jpg", "IMG_10.jpg", "a.jpg", "b.jpg", "IMG_9.jpg"]);
  });
  it("turns stamps into the site's dates", () => {
    expect(stamp("2025:03:24 17:18:47")).toBe("2025-03-24T17:18:47");
    expect(stamp("0000:00:00 00:00:00")).toBeUndefined();
    expect(dateWord("2026-01-05T00:00:00")).toBe("5 Jan 2026");
  });
});

describe("a HEIC file", () => {
  it("gives the same title, caption, by-line and moment as the JPEG it was made from", () => {
    const h = readMeta(buf("tests/fixtures/joun.heic")), j = readMeta(buf("design/folio/img/12.jpg"));
    expect(h.title).toBe("Winding Road in Joun"); expect(h.caption).toBe(j.caption); expect(h.byline).toBe("Habib Saleh");
    expect(h.taken).toBe("2025-03-07T17:03:14"); expect(h.date).toBe("7 Mar 2025");
  });
  it("gives nothing for a file that only pretends to be one", () => {
    const fake = new Uint8Array(64); fake.set([0, 0, 0, 32, 0x66, 0x74, 0x79, 0x70], 0);
    expect(readMeta(fake.buffer)).toEqual({});
  });
});
