import { z } from "zod";
export const intentionSchema = z
  .object({
    id: z.string().min(1).max(100),
    kind: z.enum(["together", "follows"]),
    from: z.string().min(1),
    to: z.string().min(1),
    scope: z.enum(["desktop", "mobile", "both"]),
  })
  .strict();
export type Intention = z.infer<typeof intentionSchema>;
export const appliesTo = (r: Intention, device: "desktop" | "mobile") =>
  r.scope === "both" || r.scope === device;
/** Intentions constrain future exploration only; the manual canvas need not satisfy them. */
export function intentionErrors(rules: Intention[], ids: string[]): string[] {
  const errors: string[] = [];
  if (new Set(rules.map((r) => r.id)).size !== rules.length)
    errors.push("Intentions need unique identities.");
  if (
    rules.some(
      (r) => r.from === r.to || !ids.includes(r.from) || !ids.includes(r.to),
    )
  )
    errors.push("An intention must name two different, existing works.");
  for (const device of ["desktop", "mobile"] as const) {
    const active = rules.filter((r) => appliesTo(r, device));
    const keys = active.map(
      (r) =>
        `${r.kind}:${r.kind === "together" ? [r.from, r.to].sort().join(":") : `${r.from}:${r.to}`}`,
    );
    if (new Set(keys).size !== keys.length)
      errors.push(`Duplicate ${device} intentions overlap in scope.`);
    const links = active.filter((r) => r.kind === "follows");
    if (
      new Set(links.map((r) => r.from)).size !== links.length ||
      new Set(links.map((r) => r.to)).size !== links.length
    )
      errors.push(
        `Conflicting ${device} reading order: only one work can immediately follow another.`,
      );
    for (const start of ids) {
      const seen = new Set<string>();
      let next: string | undefined = start;
      while (next) {
        if (seen.has(next)) {
          errors.push(`The ${device} reading order contains a cycle.`);
          break;
        }
        seen.add(next);
        next = links.find((r) => r.from === next)?.to;
      }
    }
  }
  return [...new Set(errors)];
}
export const intentionsSchema = z.array(intentionSchema).max(32);
