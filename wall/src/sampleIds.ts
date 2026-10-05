export const sampleIds = [
  "mara",
  "sora",
  "noor",
  "ivo",
  "elena",
  "kai",
  "ada",
  "common",
  "lina",
  "remy",
] as const;
export type SampleId = (typeof sampleIds)[number];
