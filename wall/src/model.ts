import { intentionsSchema, intentionErrors } from "./intentions";
import { ritualProvenanceSchema } from "./ritualContract";
import { uid } from "./ids";
export { uid } from "./ids";
export { demoAssets, mediaCredit } from "./mediaDefinitions";
import { z } from "zod";
const short = z.string().max(500);
export const originalStyleIds = [
  "folio",
  "gallery",
  "cinema",
  "archive",
] as const;
export const styleIds = [
  ...originalStyleIds,
  "gazette",
  "horizon",
  "poster",
  "atelier",
  "journal",
  "montage",
] as const;
export const appearanceSchema = z.object({
  theme: z.enum(["paper", "white", "ink"]),
  typography: z.enum(["editorial", "modern"]),
  spacing: z.number().min(50).max(130),
});
export type Appearance = z.infer<typeof appearanceSchema>;
export const defaultAppearances = {
  folio: { theme: "paper", typography: "editorial", spacing: 90 },
  gallery: { theme: "white", typography: "editorial", spacing: 110 },
  cinema: { theme: "ink", typography: "editorial", spacing: 70 },
  archive: { theme: "paper", typography: "modern", spacing: 50 },
  gazette: { theme: "paper", typography: "editorial", spacing: 70 },
  horizon: { theme: "white", typography: "modern", spacing: 80 },
  poster: { theme: "paper", typography: "modern", spacing: 100 },
  atelier: { theme: "white", typography: "modern", spacing: 90 },
  journal: { theme: "paper", typography: "editorial", spacing: 100 },
  montage: { theme: "white", typography: "editorial", spacing: 80 },
} satisfies Record<(typeof styleIds)[number], Appearance>;
const legacyBlockSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["image", "text", "video"]),
  text: z.string().max(30000),
  assetId: z.string(),
  caption: short,
  alt: short,
  width: z.enum(["full", "inset"]),
  fit: z.enum(["original", "landscape", "portrait"]),
  focal: z
    .object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) })
    .default({ x: 50, y: 50 }),
});
const legacyPageSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["home", "project", "writing", "about"]),
  title: short,
  label: short,
  subtitle: z.string().max(5000),
  meta: short,
  inNav: z.boolean(),
  blocks: z.array(legacyBlockSchema).max(100),
});
export const typeOverridesSchema = z
  .object({
    font: z.enum(["serif", "sans", "humanist", "mono"]).optional(),
    size: z.number().min(10).max(120).optional(),
    leading: z.number().min(0.8).max(3).optional(),
    tracking: z.number().min(-0.08).max(0.4).optional(),
    align: z.enum(["start", "center", "end", "justify"]).optional(),
    measure: z.number().min(12).max(120).optional(),
    flow: z.enum(["prose", "poem"]).optional(),
  })
  .strict();
export const blockTypographySchema = z
  .object({
    styleId: z.string().min(1).max(100).nullable(),
    base: typeOverridesSchema,
    mobile: typeOverridesSchema,
  })
  .strict();
export const textStyleSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(60),
    role: z.enum(["poem", "statement", "note", "custom"]),
    base: typeOverridesSchema,
    mobile: typeOverridesSchema,
  })
  .strict();
export const blockSchema = legacyBlockSchema.extend({
  typography: blockTypographySchema.optional(),
});
export const pageSchema = legacyPageSchema.extend({
  blocks: z.array(blockSchema).max(100),
});
export type TypeOverrides = z.infer<typeof typeOverridesSchema>;
export type BlockTypography = z.infer<typeof blockTypographySchema>;
export type TextStyle = z.infer<typeof textStyleSchema>;
const legacySectionSchema = z.object({
  id: z.string().min(1),
  blockIds: z.array(z.string().min(1)).min(1).max(4),
  layout: z.enum(["stack", "columns", "emphasis-left", "emphasis-right"]),
  width: z.enum(["full", "wide", "reading"]),
  align: z.enum(["left", "center", "right"]),
  vertical: z.enum(["start", "center", "end"]),
  gap: z.number().min(8).max(80),
  space: z.number().min(0).max(180),
  mobile: z.object({
    layout: z.enum(["stack", "columns"]),
    reverse: z.boolean(),
    width: z.enum(["full", "inset"]),
    gap: z.number().min(8).max(64),
    space: z.number().min(0).max(120),
  }),
});
const legacyCompositionSchema = z
  .object({
    enabled: z.boolean(),
    sections: z.array(legacySectionSchema).max(100),
    mobileOrder: z.array(z.string()).max(100).nullable(),
  })
  .strict()
  .superRefine((c, ctx) => {
    const ids = c.sections.map((s) => s.id),
      refs = c.sections.flatMap((s) => s.blockIds);
    if (
      new Set(ids).size !== ids.length ||
      new Set(refs).size !== refs.length ||
      (c.mobileOrder &&
        (c.mobileOrder.length !== ids.length ||
          new Set(c.mobileOrder).size !== ids.length ||
          c.mobileOrder.some((id) => !ids.includes(id))))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Historical composition has invalid work references or mobile section order.",
      });
  });
const legacyStudySchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(80),
    createdAt: z.string().max(40),
    order: z.array(z.string().min(1)).max(100),
    composition: legacyCompositionSchema.nullable(),
  })
  .superRefine((study, ctx) => {
    const ids = study.composition?.sections.map((s) => s.id) ?? [];
    const refs = study.composition?.sections.flatMap((s) => s.blockIds);
    if (
      new Set(study.order).size !== study.order.length ||
      (refs && JSON.stringify(refs) !== JSON.stringify(study.order)) ||
      new Set(ids).size !== ids.length ||
      (study.composition?.mobileOrder &&
        (new Set(study.composition.mobileOrder).size !== ids.length ||
          study.composition.mobileOrder.length !== ids.length ||
          study.composition.mobileOrder.some((id) => !ids.includes(id))))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "A composition study must preserve a complete, unique work order.",
      });
  });
const legacyComposedPageSchema = legacyPageSchema.extend({
  composition: legacyCompositionSchema.nullable().default(null),
});

const versionNineSectionSchema = z
  .object({
    id: z.string().min(1),
    blockIds: z.array(z.string().min(1)).min(1).max(4),
    layout: z.enum(["stack", "columns", "emphasis-left", "emphasis-right"]),
    width: z.enum(["full", "wide", "reading", "inset"]),
    align: z.enum(["left", "center", "right"]),
    vertical: z.enum(["start", "center", "end"]),
    gap: z.number().min(8).max(80),
    space: z.number().min(0).max(180),
  })
  .strict();
const versionNineCompositionSchema = z
  .object({
    enabled: z.boolean(),
    desktop: z.array(versionNineSectionSchema).max(100),
    mobile: z.array(versionNineSectionSchema).max(100),
  })
  .strict()
  .superRefine((c, ctx) => {
    for (const device of ["desktop", "mobile"] as const) {
      const sections = c[device],
        ids = sections.map((s) => s.id),
        refs = sections.flatMap((s) => s.blockIds);
      if (
        new Set(ids).size !== ids.length ||
        new Set(refs).size !== refs.length
      )
        ctx.addIssue({
          code: "custom",
          message: `${device} groups and work occurrences must be unique.`,
        });
      if (
        sections.some((s) =>
          device === "mobile"
            ? !["stack", "columns"].includes(s.layout) ||
              !["full", "inset"].includes(s.width) ||
              s.gap > 64 ||
              s.space > 120
            : s.width === "inset",
        )
      )
        ctx.addIssue({
          code: "custom",
          message: `${device} group geometry is invalid.`,
        });
    }
  });
const versionNineStudySchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(80),
    createdAt: z.string().max(40),
    order: z.array(z.string().min(1)).max(100),
    composition: versionNineCompositionSchema.nullable(),
  })
  .superRefine((study, ctx) => {
    const c = study.composition;
    const desktop = c?.desktop.flatMap((s) => s.blockIds),
      mobile = c?.mobile.flatMap((s) => s.blockIds);
    if (
      new Set(study.order).size !== study.order.length ||
      (desktop && JSON.stringify(desktop) !== JSON.stringify(study.order)) ||
      (mobile &&
        (mobile.length !== study.order.length ||
          mobile.some((id) => !study.order.includes(id))))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "A study must cover its complete work set exactly once in each viewport.",
      });
  });
const versionTenSectionSchema = versionNineSectionSchema.extend({
  widthPercent: z.number().min(25).max(100).optional(),
  columnRatio: z.number().min(20).max(80).optional(),
});
const versionTenCompositionSchema = versionNineCompositionSchema.safeExtend({
  desktop: z.array(versionTenSectionSchema).max(100),
  mobile: z.array(versionTenSectionSchema).max(100),
});
const versionTenStudySchema = versionNineStudySchema.safeExtend({
  composition: versionTenCompositionSchema.nullable(),
});
export const spatialFrameSchema = z
  .object({
    blockId: z.string().min(1),
    x: z.number().min(0).max(90),
    y: z.number().min(0).max(100000),
    width: z.number().min(10).max(100),
  })
  .strict()
  .refine(
    (f) => f.x + f.width <= 100.00001,
    "Spatial work exceeds the horizontal section edge.",
  );
export const spatialSchema = z
  .object({
    enabled: z.boolean(),
    minHeight: z.number().min(0).max(100000),
    frames: z.array(spatialFrameSchema).min(1).max(4),
    layers: z.array(z.string().min(1)).min(1).max(4),
  })
  .strict();
const versionElevenSectionSchema = versionTenSectionSchema
  .extend({ spatial: spatialSchema.optional() })
  .superRefine((s, ctx) => {
    if (!s.spatial) return;
    for (const ids of [
      s.spatial.frames.map((f) => f.blockId),
      s.spatial.layers,
    ])
      if (
        ids.length !== s.blockIds.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !s.blockIds.includes(id))
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Spatial frames and layers must cover this section's works exactly once.",
        });
  });
const versionElevenCompositionSchema = versionNineCompositionSchema.safeExtend({
  desktop: z.array(versionElevenSectionSchema).max(100),
  mobile: z.array(versionElevenSectionSchema).max(100),
});
const versionElevenStudySchema = versionNineStudySchema.safeExtend({
  composition: versionElevenCompositionSchema.nullable(),
});
export const captionTreatmentSchema = z
  .object({
    blockId: z.string().min(1),
    position: z.enum(["below", "above"]).optional(),
    backing: z.enum(["none", "paper", "ink"]).optional(),
    size: z.number().min(10).max(24).optional(),
  })
  .strict();
export type CaptionTreatment = z.infer<typeof captionTreatmentSchema>;
export const sectionSchema = versionElevenSectionSchema
  .safeExtend({
    captions: z.array(captionTreatmentSchema).max(4).optional(),
  })
  .superRefine((s, ctx) => {
    const ids = (s.captions ?? []).map((c) => c.blockId);
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => !s.blockIds.includes(id))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Caption treatments must reference unique works in their section.",
      });
  });
export const compositionSchema = versionNineCompositionSchema.safeExtend({
  desktop: z.array(sectionSchema).max(100),
  mobile: z.array(sectionSchema).max(100),
});
const versionTwelveStudySchema = versionNineStudySchema.safeExtend({
  composition: compositionSchema.nullable(),
});
export const compositionStudySchema = versionTwelveStudySchema
  .safeExtend({ intentions: intentionsSchema.optional() })
  .superRefine((s, ctx) => {
    for (const message of intentionErrors(s.intentions ?? [], s.order))
      ctx.addIssue({ code: "custom", message });
  });
const versionNinePageSchema = legacyPageSchema.extend({
  composition: versionNineCompositionSchema.nullable().default(null),
});
const versionTenPageSchema = pageSchema.extend({
  composition: versionTenCompositionSchema.nullable().default(null),
});
export const composedPageSchema = pageSchema.extend({
  composition: compositionSchema.nullable().default(null),
});
export type SpatialFrame = z.infer<typeof spatialFrameSchema>;
export type SpatialLayout = z.infer<typeof spatialSchema>;
export type CompositionSection = z.infer<typeof sectionSchema>;
export type Composition = z.infer<typeof compositionSchema>;
export type CompositionStudy = z.infer<typeof compositionStudySchema>;
export function migrateComposition(
  c: z.infer<typeof legacyCompositionSchema> | null,
): Composition | null {
  if (!c) return null;
  const byId = new Map(c.sections.map((s) => [s.id, s]));
  return {
    enabled: c.enabled,
    desktop: c.sections.map(({ mobile, ...s }) => {
      void mobile;
      return s;
    }),
    mobile: (c.mobileOrder ?? c.sections.map((s) => s.id)).map((id) => {
      const s = byId.get(id)!;
      return {
        id: `mobile-${s.id}`,
        blockIds: s.mobile.reverse
          ? [...s.blockIds].reverse()
          : [...s.blockIds],
        layout: s.mobile.layout,
        width: s.mobile.width,
        align: s.align,
        vertical: s.vertical,
        gap: s.mobile.gap,
        space: s.mobile.space,
      };
    }),
  };
}
const contentFields = {
  name: short,
  tagline: short,
  email: z.union([z.literal(""), z.email()]),
  pages: z.array(legacyPageSchema).min(1).max(50),
};
const legacySchema = z.object({
  ...contentFields,
  version: z.literal(1),
  styleId: z.literal("folio"),
  ...appearanceSchema.shape,
});
export const identitySchema = z.object({
  canvas: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .default(null),
  ink: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .default(null),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .default(null),
  headingFont: z
    .enum(["style", "serif", "sans", "humanist", "mono"])
    .default("style"),
  bodyFont: z
    .enum(["style", "serif", "sans", "humanist", "mono"])
    .default("style"),
  headingScale: z.number().min(75).max(135).default(100),
  bodyScale: z.number().min(90).max(125).default(100),
  weight: z.enum(["400", "600", "700"]).default("400"),
  tracking: z.number().min(-6).max(8).default(-4),
  margin: z.number().min(3).max(12).nullable().default(null),
  imageScale: z.number().min(60).max(100).default(100),
  alignment: z.enum(["style", "left", "center"]).default("style"),
  leading: z.number().min(1.35).max(2).default(1.65),
});
export type Identity = z.infer<typeof identitySchema>;
export const defaultIdentity = identitySchema.parse({});
export const copySchema = z.object({
  eyebrow: short,
  closingTitle: short,
  closingText: short,
  journalLink: short,
  programmeNote: short,
});
export const defaultCopy = {
  eyebrow: "An independent practice",
  closingTitle: "A space for the unfinished",
  closingText: "There is always\nmore to notice.",
  journalLink: "From the journal",
  programmeNote: "A collection of moments",
};
const versionTwoSchema = z.object({
  ...contentFields,
  version: z.literal(2),
  styleId: z.enum(originalStyleIds),
  appearances: z.object({
    folio: appearanceSchema,
    gallery: appearanceSchema,
    cinema: appearanceSchema,
    archive: appearanceSchema,
  }),
});
export const identityAppearanceSchema = appearanceSchema.extend({
  identity: identitySchema,
});
const versionThreeSchema = versionTwoSchema.extend({
  version: z.literal(3),
  copy: copySchema,
  appearances: z.object({
    folio: identityAppearanceSchema,
    gallery: identityAppearanceSchema,
    cinema: identityAppearanceSchema,
    archive: identityAppearanceSchema,
  }),
});
const versionFourSchema = versionThreeSchema.extend({
  version: z.literal(4),
  pages: z.array(legacyComposedPageSchema).min(1).max(50),
});
export const publicationSchema = z.object({
  title: z.string().max(160),
  description: z.string().max(500),
  language: z.string().max(35),
  canonical: z.string().max(2048),
});
const versionFiveSchema = versionFourSchema.extend({
  version: z.literal(5),
  publication: publicationSchema,
});
const expandedAppearancesSchema = z.object({
  folio: identityAppearanceSchema,
  gallery: identityAppearanceSchema,
  cinema: identityAppearanceSchema,
  archive: identityAppearanceSchema,
  gazette: identityAppearanceSchema,
  horizon: identityAppearanceSchema,
  poster: identityAppearanceSchema,
  atelier: identityAppearanceSchema,
  journal: identityAppearanceSchema,
  montage: identityAppearanceSchema,
});
const versionSixSchema = versionFiveSchema.extend({
  version: z.literal(6),
  styleId: z.enum(styleIds),
  appearances: expandedAppearancesSchema,
});
const versionSevenSchema = versionSixSchema.extend({
  version: z.literal(7),
  sourcePublication: ritualProvenanceSchema.nullable().default(null),
});
const versionEightSchema = versionSevenSchema.extend({
  version: z.literal(8),
  pages: z
    .array(
      legacyComposedPageSchema.extend({
        studies: z.array(legacyStudySchema).max(12).optional(),
      }),
    )
    .min(1)
    .max(50),
});
const versionNineSchema = versionSevenSchema.extend({
  version: z.literal(9),
  pages: z
    .array(
      versionNinePageSchema.extend({
        studies: z.array(versionNineStudySchema).max(12).optional(),
      }),
    )
    .min(1)
    .max(50),
});
const versionTenSchema = versionSevenSchema.extend({
  version: z.literal(10),
  textStyles: z.array(textStyleSchema).max(32).default([]),
  pages: z
    .array(
      versionTenPageSchema.extend({
        studies: z.array(versionTenStudySchema).max(12).optional(),
      }),
    )
    .min(1)
    .max(50),
});
const versionElevenSchema = versionTenSchema.extend({
  version: z.literal(11),
  pages: z
    .array(
      pageSchema.extend({
        composition: versionElevenCompositionSchema.nullable().default(null),
        studies: z.array(versionElevenStudySchema).max(12).optional(),
      }),
    )
    .min(1)
    .max(50),
});
const versionTwelveSchema = versionElevenSchema.extend({
  version: z.literal(12),
  pages: z
    .array(
      composedPageSchema.extend({
        studies: z.array(versionTwelveStudySchema).max(12).optional(),
      }),
    )
    .min(1)
    .max(50),
});
const currentSchema = versionTwelveSchema.extend({
  version: z.literal(13),
  pages: z
    .array(
      composedPageSchema.extend({
        intentions: intentionsSchema.optional(),
        studies: z.array(compositionStudySchema).max(12).optional(),
      }),
    )
    .min(1)
    .max(50),
});
export const siteInputSchema = z.discriminatedUnion("version", [
  legacySchema,
  versionTwoSchema,
  versionThreeSchema,
  versionFourSchema,
  versionFiveSchema,
  versionSixSchema,
  versionSevenSchema,
  versionEightSchema,
  versionNineSchema,
  versionTenSchema,
  versionElevenSchema,
  versionTwelveSchema,
  currentSchema,
]);
const siteMigrationSchema = siteInputSchema
  .transform((value) => {
    if (
      value.version === 13 ||
      value.version === 12 ||
      value.version === 11 ||
      value.version === 10 ||
      value.version === 9 ||
      value.version === 8 ||
      value.version === 7 ||
      value.version === 6 ||
      value.version === 5 ||
      value.version === 4
    )
      return value;
    if (value.version === 3)
      return {
        ...value,
        version: 4 as const,
        pages: value.pages.map((p) => ({ ...p, composition: null })),
      };
    const old =
      value.version === 2
        ? value
        : {
            name: value.name,
            tagline: value.tagline,
            email: value.email,
            pages: value.pages,
            styleId: "folio" as const,
            appearances: {
              ...structuredClone(defaultAppearances),
              folio: {
                theme: value.theme,
                typography: value.typography,
                spacing: value.spacing,
              },
            },
          };
    return {
      ...old,
      version: 4 as const,
      pages: old.pages.map((p) => ({ ...p, composition: null })),
      copy: { ...defaultCopy },
      appearances: {
        folio: { ...old.appearances.folio, identity: { ...defaultIdentity } },
        gallery: {
          ...old.appearances.gallery,
          identity: { ...defaultIdentity },
        },
        cinema: { ...old.appearances.cinema, identity: { ...defaultIdentity } },
        archive: {
          ...old.appearances.archive,
          identity: { ...defaultIdentity },
        },
      },
    };
  })
  .transform((value) =>
    value.version === 13 ||
    value.version === 12 ||
    value.version === 11 ||
    value.version === 10 ||
    value.version === 9 ||
    value.version === 5 ||
    value.version === 6 ||
    value.version === 7 ||
    value.version === 8
      ? value
      : {
          ...value,
          version: 5 as const,
          publication: {
            title: value.name.slice(0, 160),
            description: value.tagline,
            language: "en",
            canonical: "",
          },
        },
  )
  .transform((value) =>
    value.version === 13 ||
    value.version === 12 ||
    value.version === 11 ||
    value.version === 10 ||
    value.version === 9 ||
    value.version === 6 ||
    value.version === 7 ||
    value.version === 8
      ? value
      : {
          ...value,
          version: 6 as const,
          appearances: {
            ...value.appearances,
            gazette: {
              ...defaultAppearances.gazette,
              identity: { ...defaultIdentity },
            },
            horizon: {
              ...defaultAppearances.horizon,
              identity: { ...defaultIdentity },
            },
            poster: {
              ...defaultAppearances.poster,
              identity: { ...defaultIdentity },
            },
            atelier: {
              ...defaultAppearances.atelier,
              identity: { ...defaultIdentity },
            },
            journal: {
              ...defaultAppearances.journal,
              identity: { ...defaultIdentity },
            },
            montage: {
              ...defaultAppearances.montage,
              identity: { ...defaultIdentity },
            },
          },
        },
  )
  .transform((value) =>
    value.version === 13 ||
    value.version === 12 ||
    value.version === 11 ||
    value.version === 10 ||
    value.version === 9 ||
    value.version === 7 ||
    value.version === 8
      ? value
      : { ...value, version: 7 as const, sourcePublication: null },
  )
  .transform(
    (
      value,
    ):
      | z.input<typeof versionNineSchema>
      | z.input<typeof versionTenSchema>
      | z.input<typeof versionElevenSchema>
      | z.input<typeof versionTwelveSchema>
      | z.input<typeof currentSchema> => {
      if (
        value.version === 9 ||
        value.version === 10 ||
        value.version === 13 ||
        value.version === 12 ||
        value.version === 11
      )
        return value;
      const v8 = value as z.infer<typeof versionEightSchema>;
      return {
        ...v8,
        version: 9 as const,
        pages: v8.pages.map(({ studies, ...p }) => ({
          ...p,
          composition: migrateComposition(p.composition),
          ...(studies
            ? {
                studies: studies.map((study) => ({
                  ...study,
                  composition: migrateComposition(study.composition),
                })),
              }
            : {}),
        })),
      };
    },
  )
  .pipe(
    z.union([
      versionNineSchema,
      versionTenSchema,
      versionElevenSchema,
      versionTwelveSchema,
      currentSchema,
    ]),
  )
  .transform(
    (
      value,
    ):
      | z.input<typeof versionTenSchema>
      | z.input<typeof versionElevenSchema>
      | z.input<typeof versionTwelveSchema>
      | z.input<typeof currentSchema> =>
      value.version === 10 ||
      value.version === 13 ||
      value.version === 12 ||
      value.version === 11
        ? value
        : { ...value, version: 10 as const, textStyles: [] },
  )
  .pipe(
    z.union([
      versionTenSchema,
      versionElevenSchema,
      versionTwelveSchema,
      currentSchema,
    ]),
  )
  .transform(
    (value): z.input<typeof currentSchema> => ({
      ...value,
      version: 13 as const,
    }),
  )
  .pipe(currentSchema)
  .superRefine((s, ctx) => {
    const styles = s.textStyles,
      styleIds = new Set(styles.map((t) => t.id)),
      names = new Set(styles.map((t) => t.name.toLocaleLowerCase()));
    if (styleIds.size !== styles.length || names.size !== styles.length)
      ctx.addIssue({
        code: "custom",
        message: "Text styles need unique identities and names.",
      });
    for (const p of s.pages)
      for (const b of p.blocks)
        if (
          b.typography &&
          (b.type !== "text" ||
            (b.typography.styleId && !styleIds.has(b.typography.styleId)))
        )
          ctx.addIssue({
            code: "custom",
            message:
              "Typography must reference an existing style on a text work.",
          });
    const ids = s.pages.flatMap((p) => [p.id, ...p.blocks.map((b) => b.id)]);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Every page and block needs a unique identity.",
      });
    for (const page of s.pages) {
      for (const message of intentionErrors(
        page.intentions ?? [],
        page.blocks.map((b) => b.id),
      ))
        ctx.addIssue({ code: "custom", message });
      if (
        new Set(page.studies?.map((study) => study.id)).size !==
        (page.studies?.length ?? 0)
      )
        ctx.addIssue({
          code: "custom",
          message: "Every composition study needs a unique identity.",
        });
      const c = page.composition;
      if (!c) continue;
      const desktop = c.desktop.flatMap((s) => s.blockIds),
        mobile = c.mobile.flatMap((s) => s.blockIds);
      if (
        page.kind === "home" ||
        desktop.length !== page.blocks.length ||
        desktop.some((id, i) => id !== page.blocks[i]?.id) ||
        mobile.length !== page.blocks.length ||
        mobile.some((id) => !page.blocks.some((b) => b.id === id))
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Each viewport must cover every work exactly once; desktop order must match source order.",
        });
    }
    if (s.pages.filter((p) => p.kind === "home").length !== 1)
      ctx.addIssue({
        code: "custom",
        message: "A site must have one home page.",
      });
  });
/** Validate untouched input before migration can discard strict-field errors.
 * Keep the final result gate outside the migration pipeline: a later union must
 * never discard an earlier strict-object issue while accepting normalized data. */
export const siteSchema = z.unknown().transform((raw, ctx) => {
  const envelope = raw as {
    version?: unknown;
    pages?: { intentions?: unknown; studies?: { intentions?: unknown }[] }[];
  } | null;
  if (
    envelope &&
    typeof envelope.version === "number" &&
    envelope.version < 13 &&
    Array.isArray(envelope.pages) &&
    envelope.pages.some(
      (p) =>
        p &&
        (p.intentions !== undefined ||
          (Array.isArray(p.studies) &&
            p.studies.some((s) => s && s.intentions !== undefined))),
    )
  ) {
    ctx.addIssue({
      code: "custom",
      message:
        "Composition intentions require document version 13; the input was not normalized.",
    });
    return z.NEVER;
  }
  const input = siteInputSchema.safeParse(raw);
  if (!input.success) {
    ctx.addIssue({
      code: "custom",
      message: input.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    });
    return z.NEVER;
  }
  const migrated = siteMigrationSchema.safeParse(input.data);
  if (!migrated.success) {
    ctx.addIssue({
      code: "custom",
      message: migrated.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    });
    return z.NEVER;
  }
  return migrated.data;
});
export type Site = z.infer<typeof siteSchema>;
export type RenderSite = Site & z.infer<typeof identityAppearanceSchema>;
export type Page = Site["pages"][number];
export type Block = z.infer<typeof blockSchema>;

export const blankBlock = (type: Block["type"]): Block => ({
  id: uid(),
  type,
  text: type === "text" ? "A thought, a memory, a place to begin." : "",
  assetId: "",
  caption: "",
  alt: "",
  width: "full",
  fit: "original",
  focal: { x: 50, y: 50 },
});
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length)
    return items;
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

const photograph = (
  id: string,
  assetId: string,
  caption: string,
  alt: string,
  width: Block["width"] = "full",
): Block => ({
  id,
  type: "image",
  assetId,
  caption,
  alt,
  width,
  fit: "original",
  focal: { x: 50, y: 50 },
  text: "",
});
const prose = (id: string, text: string): Block => ({
  id,
  type: "text",
  assetId: "",
  caption: "",
  alt: "",
  width: "inset",
  fit: "original",
  focal: { x: 50, y: 50 },
  text,
});
export const initialSite: Site = siteSchema.parse({
  version: 2,
  name: "Mara Ellis",
  tagline: "Photography & field notes",
  email: "",
  styleId: "folio",
  appearances: structuredClone(defaultAppearances),
  pages: [
    {
      id: "home",
      kind: "home",
      title: "A practice of\npaying attention.",
      label: "Work",
      subtitle:
        "Photographs and small observations\nfrom the places in between.",
      meta: "Selected work, 2023—2026",
      inNav: true,
      blocks: [],
    },
    {
      id: "quiet",
      kind: "project",
      title: "The shape of quiet",
      label: "The shape of quiet",
      subtitle:
        "At the edge of a landscape, there is a moment when looking becomes listening. These photographs begin there.",
      meta: "01 / Photography / 2023—2026",
      inNav: false,
      blocks: [
        photograph(
          "quiet-1",
          "sea",
          "01 — Where the water holds the light",
          "Sunlight falling across the open sea",
        ),
        prose(
          "quiet-2",
          "I used to come here for the view.\nNow I come for the time it takes to see it.",
        ),
        photograph(
          "quiet-3",
          "lake",
          "02 — A place to return to",
          "Alpine lake reflecting mountains and a small cabin",
          "inset",
        ),
        photograph(
          "quiet-4",
          "mountain",
          "03 — What remains",
          "A steep mountain peak against the sky",
        ),
      ],
    },
    {
      id: "green",
      kind: "project",
      title: "In the green hours",
      label: "In the green hours",
      subtitle: "An ongoing collection of slow mornings and borrowed light.",
      meta: "02 / Photography / Ongoing",
      inNav: false,
      blocks: [
        photograph(
          "green-1",
          "forest",
          "01 — A clearing",
          "Sunlight passing through a deep green forest",
        ),
        prose(
          "green-2",
          "Some days, the smallest change in the light is enough.",
        ),
      ],
    },
    {
      id: "notes",
      kind: "writing",
      title: "On staying a little longer",
      label: "Journal",
      subtitle: "Field note No. 01",
      meta: "September 2026 / 3 min read",
      inNav: true,
      blocks: [
        prose(
          "notes-1",
          "The first photograph is usually the one I expected to make. A line of hills. The light arriving exactly where I thought it would.\n\nThe next one asks for something else: a little patience, perhaps, or the willingness to put the camera down.\n\nI am learning to stay after the picture. To watch a place return to itself. The water moves. A branch lifts. Nothing announces that it matters.\n\nThis is a small record of that time.",
        ),
        photograph(
          "notes-2",
          "lake",
          "A place to return to.",
          "A still lake in the mountains",
          "inset",
        ),
      ],
    },
    {
      id: "about",
      kind: "about",
      title: "Looking,\nand looking again.",
      label: "About",
      subtitle:
        "Mara Ellis is a fictional artist for this local demonstration.",
      meta: "A little about the practice",
      inNav: true,
      blocks: [
        prose(
          "about-1",
          "A photographic practice concerned with landscape, attention, and the ordinary ways a place can change us.\n\nThis demonstration brings together licensed photographs from Unsplash and original sample writing. The photographs are not the work of Mara Ellis or Habib Saleh. Replace them with your own images to make this space yours.",
        ),
      ],
    },
  ],
});
