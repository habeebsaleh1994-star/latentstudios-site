import {
  prepareDisplay,
  hashBlob,
  displayBytes,
} from "../../src/mediaDelivery";
import { websiteZip } from "../../src/zip";
const result = document.querySelector("#result")!,
  images = document.querySelector("#images")!;
const button = document.querySelector<HTMLButtonElement>("#run")!;
async function alphaFixture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1800;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d")!,
    data = ctx.createImageData(1800, 1200);
  let seed = 1234;
  for (let y = 0; y < 1200; y++)
    for (let x = 450; x < 1800; x++) {
      const i = (y * 1800 + x) * 4;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data.data[i] = seed & 255;
      data.data[i + 1] = (seed >>> 8) & 255;
      data.data[i + 2] = (seed >>> 16) & 255;
      data.data[i + 3] = x < 1000 ? 128 : 255;
    }
  ctx.putImageData(data, 0, 0);
  return new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png"),
  );
}
button.onclick = async () => {
  button.disabled = true;
  images.replaceChildren();
  const reports = [];
  try {
    const cases = [
      {
        name: "Photographic landscape",
        blob: await (await fetch("/media/sea.jpg")).blob(),
      },
      {
        name: "EXIF orientation 6",
        blob: await (await fetch("/tests/fixtures/exif-sea.jpg")).blob(),
      },
      { name: "Transparent and translucent PNG", blob: await alphaFixture() },
    ];
    for (const test of cases) {
      result.textContent = "Preparing " + test.name;
      const before = await hashBlob(test.blob),
        start = performance.now(),
        record = await prepareDisplay(test.blob);
      const elapsed = performance.now() - start;
      const largest = record.variants.at(-1);
      const section = document.createElement("section"),
        title = document.createElement("h2");
      title.textContent = test.name;
      section.append(title);
      const original = new Image(),
        copy = new Image();
      original.src = URL.createObjectURL(test.blob);
      copy.src = URL.createObjectURL(largest?.blob ?? test.blob);
      section.append(original, copy);
      images.append(section);
      await Promise.all([original.decode(), copy.decode()]);
      let alpha: unknown = null;
      if (test.name.includes("PNG")) {
        const c = document.createElement("canvas");
        c.width = copy.naturalWidth;
        c.height = copy.naturalHeight;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(copy, 0, 0);
        alpha = [0.1, 0.4, 0.8].map(
          (x) =>
            ctx.getImageData(
              Math.floor(x * c.width),
              Math.floor(c.height / 2),
              1,
              1,
            ).data[3],
        );
      }
      reports.push({
        name: test.name,
        originalHashUnchanged: before === (await hashBlob(test.blob)),
        originalBytes: test.blob.size,
        largestBytes: displayBytes(record),
        elapsedMs: Math.round(elapsed),
        displayDimensions: [record.width, record.height],
        browserOriginalDimensions: [
          original.naturalWidth,
          original.naturalHeight,
        ],
        copies: record.variants.map((v) => ({
          width: v.width,
          height: v.height,
          bytes: v.blob.size,
          type: v.blob.type,
        })),
        alpha,
      });
    }
    const zip = await websiteZip([
      {
        name: "evidence.json",
        blob: new Blob([JSON.stringify(reports, null, 2)]),
      },
    ]);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(zip);
    link.download = "media-verification.zip";
    link.textContent = "Download verification ZIP";
    images.prepend(link);
    result.textContent = JSON.stringify(
      {
        passed: reports.every(
          (r) =>
            r.originalHashUnchanged &&
            r.displayDimensions.join() === r.browserOriginalDimensions.join() &&
            r.copies.length > 0,
        ),
        reports,
      },
      null,
      2,
    );
  } catch (e) {
    result.textContent = String(e);
  } finally {
    button.disabled = false;
  }
};
document.querySelector<HTMLButtonElement>("#abort")!.onclick = async () => {
  const a = new AbortController();
  a.abort();
  try {
    await prepareDisplay(
      new Blob(["fixture"], { type: "image/jpeg" }),
      a.signal,
    );
    result.textContent = "ERROR: cancelled job ran.";
  } catch (e) {
    result.textContent =
      e instanceof Error && e.name === "AbortError"
        ? "Cancelled before decoding or storing a display copy."
        : String(e);
  }
};

let generatedPackage: Blob | null = null;
document.querySelector<HTMLButtonElement>("#package")!.onclick = async () => {
  const button = document.querySelector<HTMLButtonElement>("#package")!;
  button.disabled = true;
  generatedPackage = null;
  document.querySelector<HTMLButtonElement>("#copy")!.disabled = true;
  try {
    const { createSample } = await import("../../src/samples");
    const { collectMedia } = await import("../../src/revisions");
    const { portablePackage } = await import("../../src/portable");
    const sample = document.querySelector<HTMLSelectElement>("#sample")!
      .value as "mara" | "sora" | "noor" | "ivo";
    const site = createSample(sample);
    if (sample === "mara") {
      site.pages[1].blocks[0].fit = "portrait";
      site.pages[1].blocks[0].focal = { x: 23, y: 82 };
    }
    const media = await collectMedia(site);
    for (const blob of Object.values(media.assets)) await prepareDisplay(blob);
    const revision = {
      format: "latent-studio-revision" as const,
      version: 1 as const,
      id: "fictional-media-qa-" + sample,
      name: "Fictional image-delivery check",
      createdAt: new Date().toISOString(),
      sourceRevision: 1,
      site,
      ...media,
    };
    const output = await portablePackage(revision, "web");
    generatedPackage = output.blob;
    result.textContent = JSON.stringify(
      { bytes: output.blob.size, receipt: output.receipt },
      null,
      2,
    );
    document.querySelector<HTMLButtonElement>("#copy")!.disabled = false;
  } catch (e) {
    result.textContent = String(e);
  } finally {
    button.disabled = false;
  }
};
document.querySelector<HTMLButtonElement>("#copy")!.onclick = async () => {
  if (!generatedPackage) return;
  const bytes = new Uint8Array(await generatedPackage.arrayBuffer());
  let binary = "";
  for (let at = 0; at < bytes.length; at += 16384)
    binary += String.fromCharCode(...bytes.subarray(at, at + 16384));
  let field = document.querySelector<HTMLTextAreaElement>("#package-bytes");
  if (!field) {
    field = document.createElement("textarea");
    field.id = "package-bytes";
    field.setAttribute("aria-label", "Generated ZIP bytes (base64)");
    field.readOnly = true;
    field.style.cssText = "display:block;width:100%;height:100px";
    result.after(field);
  }
  field.value = btoa(binary);
  result.setAttribute("data-copied", "true");
  await navigator.clipboard.writeText(field.value);
};
