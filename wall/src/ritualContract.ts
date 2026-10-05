import { z } from "zod";
const id = z.string().regex(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
export const ritualManifestSchema = z
  .object({
    format: z.literal("ritual-story-publication"),
    version: z.literal(1),
    packageId: id,
    producer: z
      .object({
        app: z.literal("The Ritual"),
        version: z.string().max(80),
        build: z.string().max(80),
      })
      .strict(),
    mediaPolicy: z.literal(
      "approved-rendered-srgb-png-without-source-metadata",
    ),
    story: z
      .object({
        id,
        title: z.string().max(500),
        standfirst: z.string().max(5000),
        coverAssetId: id.optional(),
        frames: z
          .array(
            z
              .object({
                id,
                assetId: id,
                role: z.enum([
                  "single",
                  "full-bleed",
                  "breath",
                  "pair-left",
                  "pair-right",
                ]),
                caption: z
                  .object({
                    source: z.enum(["inherit", "authored", "silence"]),
                    text: z.string().max(500),
                  })
                  .strict()
                  .refine(
                    (c) =>
                      c.source === "silence"
                        ? c.text === ""
                        : c.source !== "authored" || c.text.length > 0,
                    "Caption provenance and text disagree.",
                  ),
              })
              .strict(),
          )
          .min(1)
          .max(99),
      })
      .strict(),
    assets: z
      .array(
        z
          .object({
            id,
            path: z.string().regex(/^media\/[0-9a-f-]{36}\.png$/),
            mime: z.literal("image/png"),
            width: z.number().int().min(1).max(2400),
            height: z.number().int().min(1).max(2400),
            bytes: z
              .number()
              .int()
              .min(1)
              .max(30 * 1024 * 1024),
            sha256: z.string().regex(/^[0-9a-f]{64}$/),
            colorSpace: z.literal("srgb"),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((m, ctx) => {
    const refs = m.story.frames.map((f) => f.assetId);
    if (m.story.coverAssetId) refs.push(m.story.coverAssetId);
    const ids = m.assets.map((a) => a.id),
      frames = m.story.frames;
    if (
      new Set(ids).size !== ids.length ||
      new Set(frames.map((f) => f.id)).size !== frames.length ||
      new Set(frames.map((f) => f.assetId)).size !== frames.length ||
      refs.some((r) => !ids.includes(r)) ||
      ids.some((id) => !refs.includes(id)) ||
      m.assets.some((a) => a.path !== `media/${a.id}.png`)
    )
      ctx.addIssue({
        code: "custom",
        message: "Missing, duplicated or unreferenced Story media/identities.",
      });
  });
export type RitualManifest = z.infer<typeof ritualManifestSchema>;
export const ritualProvenanceSchema = z
  .object({
    manifest: ritualManifestSchema,
    packageSha256: z.string().regex(/^[0-9a-f]{64}$/),
    blocks: z
      .array(
        z
          .object({
            blockId: z.string().min(1),
            frameId: id.nullable(),
            assetId: id,
            openingCover: z.boolean(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
