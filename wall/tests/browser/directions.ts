import { createSample, sampleInfo } from "../../src/samples";
import { sampleIds, type SampleId } from "../../src/sampleIds";
import { collectMedia, type Revision } from "../../src/revisions";
import { prepareDisplay } from "../../src/mediaDelivery";
import { portableHTML, portablePackage } from "../../src/portable";
import { websiteZip } from "../../src/zip";
const select = document.querySelector<HTMLSelectElement>("#sample")!;
const button = document.querySelector<HTMLButtonElement>("#build")!;
const result = document.querySelector("#result")!;
const bytes = document.querySelector<HTMLTextAreaElement>("#bytes")!;
for (const id of sampleIds) {
  const option = document.createElement("option");
  option.value = id;
  option.textContent = sampleInfo[id].name + " · " + createSample(id).styleId;
  select.append(option);
}
button.onclick = async () => {
  button.disabled = true;
  bytes.value = "";
  result.textContent = "Collecting fictional media…";
  try {
    const id = select.value as SampleId,
      site = createSample(id),
      media = await collectMedia(site);
    for (const blob of Object.values(media.assets))
      if (["image/jpeg", "image/png", "image/webp"].includes(blob.type))
        await prepareDisplay(blob);
    const revision: Revision = {
      format: "latent-studio-revision",
      version: 1,
      id: "ten-directions-" + id,
      name: "Fictional ten-direction export verification",
      createdAt: new Date().toISOString(),
      sourceRevision: 1,
      site,
      ...media,
    };
    const html = await portableHTML(revision, "web"),
      pack = await portablePackage(revision, "web");
    const report = {
      sample: id,
      style: site.styleId,
      documentVersion: site.version,
      htmlBytes: new Blob([html]).size,
      zipBytes: pack.blob.size,
      pages: site.pages.map((p) => ({
        id: p.id,
        kind: p.kind,
        title: p.title,
        blockIds: p.blocks.map((b) => b.id),
      })),
      receipt: pack.receipt,
    };
    const zip = await websiteZip([
      { name: "single.html", blob: new Blob([html], { type: "text/html" }) },
      { name: "website.zip", blob: pack.blob },
      {
        name: "verification.json",
        blob: new Blob([JSON.stringify(report, null, 2)]),
      },
    ]);
    const data = new Uint8Array(await zip.arrayBuffer());
    let binary = "";
    for (let at = 0; at < data.length; at += 16384)
      binary += String.fromCharCode(...data.subarray(at, at + 16384));
    bytes.value = btoa(binary);
    result.textContent = JSON.stringify(report, null, 2);
  } catch (e) {
    result.textContent = String(e);
  } finally {
    button.disabled = false;
  }
};
