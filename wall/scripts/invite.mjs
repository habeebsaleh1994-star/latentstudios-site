#!/usr/bin/env node
/* Invite keys for the beta. A key is a short phrase said once, here; the service keeps only its hash (the invites
   table in D1) and lets the first email that gives the key make an account.
   Usage: node scripts/invite.mjs make <name>     a new key for a person (printed once; give it to them)
          node scripts/invite.mjs revoke <name>   the key stops working (an account already made with it stays)
          node scripts/invite.mjs list            who has a key, and which email used it
   Add --local to work on the local database `npm run api` uses instead of the live one. */
import { createHash, randomInt } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const WORDS = ["silk", "peony", "mauve", "olive", "cotton", "ink", "paper", "plate", "wall", "light", "quiet", "slow", "dusk", "dawn", "linen", "amber", "cedar", "moss", "pearl", "stone"];
const args = process.argv.slice(2), where = args.includes("--local") ? "--local" : "--remote", [cmd, name] = args.filter((a) => a !== "--local");
const q = (s) => s.replace(/'/g, "''");
function sql(command) {
  const r = spawnSync("npx", ["-y", "wrangler@latest", "d1", "execute", "latent-wall", where, "--json", "--command", command, "-c", "deploy/wrangler.toml"], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }
  const out = JSON.parse(r.stdout.slice(r.stdout.indexOf("[")));
  return out[0]?.results ?? [];
}
if (cmd === "make" && name) {
  const key = `${WORDS[randomInt(WORDS.length)]}-${WORDS[randomInt(WORDS.length)]}-${randomInt(1000, 9999)}`;
  const hash = createHash("sha256").update(key.trim().toLowerCase()).digest("hex");
  sql(`DELETE FROM invites WHERE name = '${q(name)}' AND used_by IS NULL; INSERT INTO invites (hash, name, made) VALUES ('${hash}', '${q(name)}', '${new Date().toISOString().slice(0, 10)}')`);
  console.log(`${name}: ${key}`);
} else if (cmd === "revoke" && name) {
  const n = sql(`DELETE FROM invites WHERE name = '${q(name)}' RETURNING name`).length;
  console.log(n ? `${name} revoked` : `no key for ${name}`);
} else if (cmd === "list") {
  const rows = sql("SELECT name, made, used_by FROM invites ORDER BY made, name");
  for (const k of rows) console.log(`${k.name}  (${k.made})${k.used_by ? `  used by ${k.used_by}` : "  not used yet"}`);
  if (!rows.length) console.log("no keys");
} else { console.log("usage: invite.mjs make <name> | revoke <name> | list   [--local]"); process.exit(1); }
