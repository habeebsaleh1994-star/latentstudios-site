import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";
import type { Site } from "./model";
export const TypographyContext = createContext<{
  site: Site;
  mobile: boolean;
} | null>(null);
export const useTypography = () => useContext(TypographyContext);
export function useViewportMobile(root: RefObject<HTMLElement | null>) {
  const [mobile, setMobile] = useState(false);
  useLayoutEffect(() => {
    const media =
      root.current?.ownerDocument.defaultView?.matchMedia("(max-width: 640px)");
    if (!media) return;
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [root]);
  return mobile;
}
