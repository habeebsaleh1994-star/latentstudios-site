import { openDB, deleteDB } from "idb";
import type { StudioDB } from "./database";
import { databaseName } from "./workspace";
import { atomic } from "./storage";
import { blankBlock, initialSite, siteSchema, uid, type Site } from "./model";
import { sectionFor } from "./composition";
import type { AdmittedStory } from "./ritualArchive";
export function composeStory(
  input: AdmittedStory,
  name: string,
  styleId: Site["styleId"] = "folio",
): Site {
  const story = input.manifest.story;
  const frames = story.frames.map((f) => ({
    ...blankBlock("image"),
    assetId: f.assetId,
    caption: f.caption.text,
    alt: "",
  }));
  const cover = story.coverAssetId
    ? {
        ...blankBlock("image"),
        assetId: story.coverAssetId,
        alt: "Opening cover",
      }
    : null;
  const sections = cover ? [sectionFor([cover.id])] : [];
  for (let i = 0; i < frames.length; i++) {
    const role = story.frames[i].role;
    if (role === "pair-left" && story.frames[i + 1]?.role === "pair-right") {
      sections.push(sectionFor([frames[i].id, frames[i + 1].id]));
      i++;
    } else {
      const section = sectionFor([frames[i].id]);
      if (role === "breath") {
        section.width = "reading";
        section.space = 120;
      } else if (role !== "full-bleed") section.width = "wide";
      sections.push(section);
    }
  }
  const projectId = uid();
  return siteSchema.parse({
    ...structuredClone(initialSite),
    name,
    tagline: "",
    email: "",
    styleId,
    copy: {
      eyebrow: "",
      closingTitle: "",
      closingText: "",
      journalLink: "",
      programmeNote: "",
    },
    publication: {
      title: name.slice(0, 160),
      description: "",
      language: "en",
      canonical: "",
    },
    pages: [
      {
        id: "home",
        kind: "home",
        title: name,
        label: "Home",
        subtitle: "",
        meta: "",
        inNav: false,
        blocks: [],
        composition: null,
      },
      {
        id: projectId,
        kind: "project",
        title: story.title,
        label: story.title || "Story",
        subtitle: story.standfirst,
        meta: "",
        inNav: true,
        blocks: [...(cover ? [cover] : []), ...frames],
        composition: {
          enabled: true,
          desktop: sections,
          mobile: sections.map((s) => ({
            ...sectionFor([...s.blockIds], `mobile-${s.id}`, true),
            space: s.space === 120 ? 80 : 48,
          })),
        },
      },
    ],
    sourcePublication: {
      manifest: input.manifest,
      packageSha256: input.packageSha256,
      blocks: [
        ...(cover
          ? [
              {
                blockId: cover.id,
                frameId: null,
                assetId: cover.assetId,
                openingCover: true,
              },
            ]
          : []),
        ...frames.map((b, i) => ({
          blockId: b.id,
          frameId: story.frames[i].id,
          assetId: b.assetId,
          openingCover: false,
        })),
      ],
    },
  });
}
export interface StoryDraftEntry {
  id: string;
  name: string;
  title: string;
  created: string;
}
const registry = () =>
  openDB("latent-studio-story-library-v1", 1, {
    upgrade(db) {
      db.createObjectStore("drafts", { keyPath: "id" });
    },
  });
export async function listStoryDrafts(): Promise<StoryDraftEntry[]> {
  const db = await registry();
  try {
    return ((await db.getAll("drafts")) as StoryDraftEntry[]).sort((a, b) =>
      b.created.localeCompare(a.created),
    );
  } finally {
    db.close();
  }
}
export async function createStoryDraft(
  site: Site,
  assets: Record<string, Blob>,
  approved: boolean,
): Promise<{ id: string; href: string; warning: string }> {
  if (!approved)
    throw new Error("Review the Story and confirm creation first.");
  const value = siteSchema.parse(site);
  if (!value.sourcePublication)
    throw new Error("Publication provenance is missing.");
  for (const block of value.pages.flatMap((p) => p.blocks))
    if (block.assetId && !assets[block.assetId])
      throw new Error(
        "A reviewed photograph is missing. No draft was created.",
      );
  const id = crypto.randomUUID(),
    db = await openDB<StudioDB>(databaseName(id), 1, {
      upgrade(db) {
        db.createObjectStore("documents");
        db.createObjectStore("assets");
      },
    });
  try {
    const tx = db.transaction(["documents", "assets"], "readwrite");
    await atomic(tx, async () => {
      for (const [key, blob] of Object.entries(assets))
        await tx.objectStore("assets").add(blob, key);
      await tx.objectStore("documents").add({ value, revision: 1 }, "site");
    });
  } catch (error) {
    db.close();
    await deleteDB(databaseName(id));
    throw error;
  } finally {
    db.close();
  }
  let warning = "";
  try {
    const index = await registry();
    try {
      await index.put("drafts", {
        id,
        name: value.name,
        title: value.sourcePublication.manifest.story.title,
        created: new Date().toISOString(),
      } satisfies StoryDraftEntry);
    } finally {
      index.close();
    }
  } catch {
    warning =
      "The draft was saved, but its library shortcut could not be saved. Bookmark this link and export a backup.";
  }
  return { id, href: `?studio=${id}&page=${value.pages[1].id}`, warning };
}
