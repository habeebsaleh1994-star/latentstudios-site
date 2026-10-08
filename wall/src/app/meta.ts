/*
 * What a photograph's file says about itself, read before the file is sized for the library:
 * the title, caption and date the artist already wrote in Lightroom or Capture One (IPTC and XMP),
 * and the moment it was taken (EXIF). JPEG only; other formats give nothing and lose nothing.
 */
export type Meta = { title?: string; caption?: string; byline?: string; date?: string; taken?: string };

const dec = new TextDecoder("utf-8"), latin = new TextDecoder("latin1");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2025:11:10 16:32:42" or "2025-11-10T16:32:42" to an ISO stamp, or nothing. */
export function stamp(s: string | undefined): string | undefined {
  const m = s?.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m || m[1] === "0000") return undefined;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "00"}:${m[5] ?? "00"}:${m[6] ?? "00"}`;
}
/** An ISO stamp as the site writes dates: "10 Nov 2025". */
export const dateWord = (iso: string) => { const d = iso.slice(0, 10).split("-"); return `${Number(d[2])} ${MONTHS[Number(d[1]) - 1]} ${d[0]}`; };

export function readMeta(buf: ArrayBuffer): Meta {
  const u = new Uint8Array(buf), v = new DataView(buf), out: Meta = {};
  if (u.length < 4 || u[0] !== 0xff || u[1] !== 0xd8) return out;
  const found: { exif?: Meta; iptc?: Meta; xmp?: Meta } = {};
  let i = 2;
  while (i + 4 <= u.length && u[i] === 0xff) {
    const marker = u[i + 1], len = v.getUint16(i + 2);
    if (marker === 0xda || marker === 0xd9) break;
    const start = i + 4, end = Math.min(i + 2 + len, u.length);
    if (marker === 0xe1 && latin.decode(u.subarray(start, start + 6)) === "Exif\0\0") found.exif ??= exif(buf, start + 6, end);
    else if (marker === 0xe1 && latin.decode(u.subarray(start, start + 29)) === "http://ns.adobe.com/xap/1.0/\0") found.xmp ??= xmp(dec.decode(u.subarray(start + 29, end)));
    else if (marker === 0xed && latin.decode(u.subarray(start, start + 14)) === "Photoshop 3.0\0") found.iptc ??= iptc(u, v, start + 14, end);
    i += 2 + len;
  }
  // what the artist wrote wins over what the camera wrote; the photograph's own headline over the series' name
  const x = found.xmp ?? {}, p = found.iptc ?? {}, e = found.exif ?? {};
  out.title = x.title || p.title || e.title || undefined;
  out.caption = x.caption || p.caption || e.caption || undefined;
  out.byline = x.byline || p.byline || undefined;
  out.taken = e.taken || x.taken || p.taken || undefined;
  if (out.taken) out.date = dateWord(out.taken);
  for (const k of Object.keys(out) as (keyof Meta)[]) if (!out[k]) delete out[k];
  return out;
}

function exif(buf: ArrayBuffer, tiff: number, end: number): Meta {
  const v = new DataView(buf), out: Meta & { desc?: string } = {};
  if (tiff + 8 > end) return out;
  const le = v.getUint16(tiff) === 0x4949, u16 = (o: number) => v.getUint16(o, le), u32 = (o: number) => v.getUint32(o, le);
  if (u16(tiff + 2) !== 42) return out;
  const ascii = (o: number, n: number) => latin.decode(new Uint8Array(buf, o, n)).replace(/\0+$/, "").trim();
  const read = (ifd: number, want: Record<number, (val: string) => void>, depth = 0) => {
    if (ifd <= 0 || ifd + 2 > end || depth > 2) return;
    const n = u16(ifd);
    for (let k = 0; k < n; k++) {
      const e = ifd + 2 + k * 12; if (e + 12 > end) return;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4), size = type === 2 ? count : 4, at = size > 4 ? tiff + u32(e + 8) : e + 8;
      if (tag === 0x8769) read(tiff + u32(e + 8), want, depth + 1);
      else if (want[tag] && type === 2 && at + count <= end) want[tag](ascii(at, count));
    }
  };
  read(tiff + u32(tiff + 4), { 0x9003: (s) => { out.taken = stamp(s); }, 0x0132: (s) => { out.taken ??= stamp(s); }, 0x010e: (s) => { out.caption = s || undefined; }, 0x010f: () => {} });
  return out;
}

function iptc(u: Uint8Array, v: DataView, at: number, end: number): Meta {
  const out: Meta = {};
  while (at + 12 <= end && latin.decode(u.subarray(at, at + 4)) === "8BIM") {
    const id = v.getUint16(at + 4), nameLen = u[at + 6], nameEnd = at + 7 + nameLen + ((nameLen + 1) % 2), size = v.getUint32(nameEnd), data = nameEnd + 4;
    if (id === 0x0404) {
      let p = data;
      while (p + 5 <= data + size && u[p] === 0x1c) {
        const rec = u[p + 1], set = u[p + 2], n = v.getUint16(p + 3), text = dec.decode(u.subarray(p + 5, p + 5 + n)).trim();
        if (rec === 2) {
          if (set === 105) out.title = text; else if (set === 5 && !out.title) out.title = text;
          else if (set === 120) out.caption = text; else if (set === 80) out.byline = text; else if (set === 55 && /^\d{8}$/.test(text)) out.taken = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6)}T00:00:00`;
        }
        p += 5 + n;
      }
    }
    at = data + size + (size % 2);
  }
  return out;
}

function xmp(x: string): Meta {
  const out: Meta = {};
  const li = (ns: string) => { const m = x.match(new RegExp(`<${ns}>\\s*<rdf:Alt>\\s*<rdf:li[^>]*>([^<]*)<\\/rdf:li>`)) ?? x.match(new RegExp(`<${ns}>([^<]*)<\\/${ns}>`)); return m ? unescapeXml(m[1].trim()) : undefined; };
  const attr = (name: string) => { const m = x.match(new RegExp(`${name}="([^"]*)"`)) ?? x.match(new RegExp(`<${name}>([^<]*)<\\/${name}>`)); return m ? unescapeXml(m[1].trim()) : undefined; };
  out.title = attr("photoshop:Headline") || li("dc:title");
  out.caption = li("dc:description");
  const by = x.match(/<dc:creator>\s*<rdf:Seq>\s*<rdf:li>([^<]*)<\/rdf:li>/); out.byline = by ? unescapeXml(by[1].trim()) : undefined;
  out.taken = stamp(attr("exif:DateTimeOriginal")) || stamp(attr("photoshop:DateCreated")) || stamp(attr("xmp:CreateDate"));
  return out;
}
const unescapeXml = (s: string) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&");

/** Works in the order they were taken, then by name, so a dropped folder arrives as a sequence. */
export function inOrder<T extends { taken?: string; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.taken && b.taken ? a.taken.localeCompare(b.taken) : a.taken ? -1 : b.taken ? 1 : 0) || a.name.localeCompare(b.name, undefined, { numeric: true }));
}
