/**
 * Sistema de layout + sidebar para apps (Fotorank, Fotoffice, ComprameLaFoto, …).
 * Configuración dinámica: tipos y `filterSidebarByRoles` en `../../sidebar/`.
 */

export { AppLayout } from "./AppLayout";
export type { AppLayoutProps } from "./AppLayout";

export { Sidebar } from "./Sidebar";
export type { SidebarProps } from "./Sidebar";

export { SidebarBody } from "./SidebarBody";
export type { SidebarBodyProps } from "./SidebarBody";

export { SidebarHeader } from "./SidebarHeader";
export type { SidebarHeaderProps } from "./SidebarHeader";

export { SidebarSection } from "./SidebarSection";
export type { SidebarSectionProps } from "./SidebarSection";

export { SidebarItem } from "./SidebarItem";
export type { SidebarItemProps, SidebarLinkComponent, SidebarLinkComponentProps } from "./SidebarItem";

export { SidebarFooter } from "./SidebarFooter";
export type { SidebarFooterProps } from "./SidebarFooter";

export { SidebarNavFromConfig } from "./SidebarNavFromConfig";
export type { SidebarNavFromConfigProps } from "./SidebarNavFromConfig";

export { SIDEBAR_WIDTH_PX, SIDEBAR_MOBILE_MEDIA } from "./constants";

export type {
  SidebarItemConfig,
  SidebarSectionConfig,
  SidebarMenuItem,
  SidebarMenuSection,
} from "../../sidebar/sidebarConfig.types";
export { filterSidebarByRoles } from "../../sidebar/filterSidebarByRoles";
export { isSidebarPathActive } from "../../sidebar/pathUtils";
