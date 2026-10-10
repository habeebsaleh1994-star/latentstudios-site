#!/usr/bin/env node
/* Invite keys for the beta. The app ships only hashes (app/keys.json); the key itself is said once, here.
   Usage: node scripts/invite.mjs make <name>     a new key for a person (printed once; give it to them)
          node scripts/invite.mjs revoke <name>   the key stops working at the next visit
          node scripts/invite.mjs list            who has a key */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomInt } from "node:crypto";
import { resolve, dirname } from "node:path";
const file = resolve(dirname(new URL(import.meta.url).pathname), "../app/keys.json");
const read = () => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return { keys: [] }; } };
const WORDS = ["silk", "peony", "mauve", "olive", "cotton", "ink", "paper", "plate", "wall", "light", "quiet", "slow", "dusk", "dawn", "linen", "amber", "cedar", "moss", "pearl", "stone"];
const [cmd, name] = process.argv.slice(2); const db = read();
if (cmd === "make" && name) {
  const key = `${WORDS[randomInt(WORDS.length)]}-${WORDS[randomInt(WORDS.length)]}-${randomInt(1000, 9999)}`;
  const hash = createHash("sha256").update(key.trim().toLowerCase()).digest("hex");
  db.keys = db.keys.filter((k) => k.name !== name).concat({ name, hash, made: new Date().toISOString().slice(0, 10) });
  writeFileSync(file, JSON.stringify(db, null, 1) + "\n"); console.log(`${name}: ${key}`);
} else if (cmd === "revoke" && name) { const n = db.keys.length; db.keys = db.keys.filter((k) => k.name !== name); writeFileSync(file, JSON.stringify(db, null, 1) + "\n"); console.log(n === db.keys.length ? `no key for ${name}` : `${name} revoked`); }
else if (cmd === "list") { for (const k of db.keys) console.log(`${k.name}  (${k.made})`); if (!db.keys.length) console.log("no keys"); }
else { console.log("usage: invite.mjs make <name> | revoke <name> | list"); process.exit(1); }
