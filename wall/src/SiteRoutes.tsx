import { createContext, useContext } from "react";
import { siteHref } from "./workspace";
export const SiteRoutes = createContext<(id: string) => string>(siteHref);
export const useSiteHref = () => useContext(SiteRoutes);
