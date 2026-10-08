/*
 * A page behind a word. The published files are static, so the only honest privacy is to seal the
 * page itself: its drawn html is encrypted with a key derived from the word (PBKDF2 → AES-GCM), and
 * the visitor's browser opens it when the word is given. Nothing readable is left in the file.
 */
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export type Sealed = { salt: string; iv: string; data: string };
/** A word, not a password: case and the spaces around it are forgiven. */
export const fold = (w: string) => w.normalize("NFKC").trim().toLowerCase();

async function keyFor(word: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", enc.encode(fold(word)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt as BufferSource, iterations: 120000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
/** Seal text with a word. A fresh salt and iv each time, so two pages behind the same word share nothing readable. */
export async function seal(text: string, word: string): Promise<Sealed> {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFor(word, salt), enc.encode(text));
  return { salt: b64(salt), iv: b64(iv), data: b64(data) };
}
/** Open sealed text with a word; null when the word is wrong. */
export async function open(s: Sealed, word: string): Promise<string | null> {
  try { return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(s.iv) }, await keyFor(word, unb64(s.salt)), unb64(s.data))); } catch { return null; }
}
