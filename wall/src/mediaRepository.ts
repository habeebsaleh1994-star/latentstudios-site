import { database } from "./database";
export async function storeAsset(file: Blob): Promise<string> {
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
    ].includes(file.type)
  )
    throw new Error("Choose a JPG, PNG, WebP, GIF, MP4 or WebM file.");
  if (file.size > 30 * 1024 * 1024)
    throw new Error("This local edition supports files up to 30 MB.");
  const id = crypto.randomUUID();
  const db = await database();
  await db.put("assets", file, id);
  return id;
}
export async function readAsset(id: string) {
  const db = await database();
  return db.get("assets", id);
}
