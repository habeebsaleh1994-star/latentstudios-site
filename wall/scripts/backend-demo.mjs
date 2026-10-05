import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const scratch = await mkdtemp(join(tmpdir(), "latent-backend-run-"));
try {
  const output = join(scratch, "demo.mjs");
  await build({
    entryPoints: ["backend/demo.ts"],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node25",
    logLevel: "silent",
  });
  const { runDemo } = await import(pathToFileURL(output).href);
  console.log(JSON.stringify(await runDemo(), null, 2));
} finally {
  await rm(scratch, { recursive: true, force: true });
}
