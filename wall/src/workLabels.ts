import type { Block } from "./model";
export const workLabel = (block: Block) =>
  (
    (block.type === "text" ? block.text : block.caption || block.alt) ||
    "Untitled work"
  ).slice(0, 70);
