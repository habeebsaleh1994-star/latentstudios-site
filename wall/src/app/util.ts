/** "2.39:1", "16:9" or "1.85" as width over height; anything else is a 16:9 screen. */
export function ratioNumber(r: string): number {
  const m = r.trim().match(/^(\d+(?:\.\d+)?)\s*(?::|\/|x)\s*(\d+(?:\.\d+)?)$/) ?? r.trim().match(/^(\d+(?:\.\d+)?)$/);
  if (!m) return 16 / 9;
  const n = m[2] ? parseFloat(m[1]) / parseFloat(m[2]) : parseFloat(m[1]);
  return n >= 0.5 && n <= 4 ? n : 16 / 9;
}
