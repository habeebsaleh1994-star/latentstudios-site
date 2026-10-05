import type { RenderSite } from "./model";
export interface RendererProps {
  site: RenderSite;
  pageId: string;
  navigate: (id: string) => void;
  onEdit?: (blockId: string) => void;
  focusBlockId?: string | null;
}
