import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
for (const script of [
  "verify-relationships-browser.mjs",
  "verify-relationship-boundaries.mjs",
  "verify-relationship-regressions.mjs",
]) {
  const r = spawnSync(process.execPath, [`scripts/${script}`], {
    env: process.env,
    encoding: "utf8",
  });
  writeFileSync(
    `docs/evidence/relationships/${script}.log`,
    r.stdout + r.stderr,
  );
  console.log(script, r.status === 0 ? "PASS" : "FAIL");
  if (r.status !== 0) {
    console.error(r.stdout + r.stderr);
    process.exit(r.status || 1);
  }
}
