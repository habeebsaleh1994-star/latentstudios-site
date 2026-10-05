import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
for (const [script, folder] of [
  ["verify-selection-gestures-browser.mjs", "gesture-regression"],
  ["verify-canvas-focus-browser.mjs", "focus-regression"],
  ["verify-independent-viewports-browser.mjs", "independent-regression"],
]) {
  const root = resolve("docs/evidence/relationships", folder),
    r = spawnSync(process.execPath, [`scripts/${script}`], {
      env: { ...process.env, LATENT_EVIDENCE_DIRECTORY: root + "/" },
      encoding: "utf8",
    });
  writeFileSync(root + "/run.log", r.stdout + r.stderr);
  console.log(script, r.status === 0 ? "PASS" : "FAIL");
  if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(r.status || 1);
  }
}
