/*
 * Files from the computer, the one way in: each is read for what it says about itself, sized, kept, and joins
 * the library in the order taken. Used by the editor (the library, a folder, a drop) and by the start page.
 */
import type { SiteDocument } from "../studio/site";
import type { Store } from "./store";
import { addToLibrary } from "./ops";
import { inOrder } from "./meta";

export const isImage = (f: File) => /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name);
/** The folder a set of files came from, as a name. */
export const folderOf = (files: File[]) => (files[0]?.webkitRelativePath?.split("/")[0] ?? "").replace(/[-_]+/g, " ");

export async function bringIn(store: Store, site: SiteDocument, files: File[]) {
  let s = site; const errors: string[] = [], got: { id: string; taken?: string; name: string }[] = [];
  for (const f of files) {
    if (f.name.startsWith(".")) continue;
    try { const r = await store.putImage(f); s = addToLibrary(s, r.id, r); got.push({ id: r.id, taken: r.taken, name: f.webkitRelativePath || f.name }); }
    catch (err) { errors.push((err as Error).message); }
  }
  await store.prepare(Object.keys(s.library));
  return { site: s, ids: inOrder(got).map((g) => g.id), errors };
}

export const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
/** What was dropped: the files, walking into folders, with the first folder's name. */
export async function dropped(e: DragEvent): Promise<{ files: File[]; folder: string }> {
  const items = [...(e.dataTransfer?.items ?? [])], files: File[] = []; let folder = "";
  const take = (f: File, prefix: string) => { if (prefix) Object.defineProperty(f, "webkitRelativePath", { value: prefix + f.name }); files.push(f); };
  const walk = async (entry: FileSystemEntry, prefix: string, fallback: File | null): Promise<void> => {
    if (entry.isFile) { try { take(await new Promise<File>((ok, no) => (entry as FileSystemFileEntry).file(ok, no)), prefix); } catch { if (fallback) take(fallback, prefix); } }
    else if (entry.isDirectory) { folder ||= entry.name; const rd = (entry as FileSystemDirectoryEntry).createReader(); let batch: FileSystemEntry[]; do { batch = await new Promise((ok, no) => rd.readEntries(ok, no)); for (const x of batch) await walk(x, `${prefix}${entry.name}/`, null); } while (batch.length); }
  };
  for (const it of items) { const entry = it.webkitGetAsEntry?.(); if (entry) await walk(entry, "", it.getAsFile()); else { const f = it.getAsFile(); if (f) files.push(f); } }
  return { files: files.filter(isImage), folder: folder.replace(/[-_]+/g, " ") };
}
