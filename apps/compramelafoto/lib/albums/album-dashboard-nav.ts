/**
 * Navegación del detalle de álbum en el panel (Fase 2 UX).
 * Mapea pestañas legacy (`?tab=`) a secciones del workspace.
 */

import { isAlbumCommercialUnifiedUiEnabled } from "@/lib/commercial/album-commercial-unified-ui-feature-flag";
/** Etiqueta tab packs galería (AlbumPack). */
export function albumGalleryTabLabel(): string {
  return "Packs de galería";
}

/** Etiqueta tab preventa canjeable (PackDefinition). */
export function albumPreventaTabLabel(): string {
  return "Packs de preventa";
}

/** Subpestaña principal de venta: productos habilitados en el álbum. */
export function albumSalesTypesTabLabel(): string {
  return "Qué vendés";
}

/** Subpestaña extras y upsells. */
export function albumExtrasTabLabel(): string {
  return "Extras y adicionales";
}

/** Subpestaña comisión escolar (álbumes modo SCHOOL). */
export function albumSchoolCommissionTabLabel(): string {
  return "Comisión escolar";
}

export type AlbumDashboardSectionId =
  | "resumen"
  | "contenido"
  | "venta"
  | "pedidos"
  | "escuela"
  | "publicacion"
  | "configuracion";

/** Pestañas legacy del dashboard (`?tab=`). */
export type AlbumDashboardLegacyTabId =
  | "resumen"
  | "fotos"
  | "videos"
  | "ventas"
  | "packs"
  | "preventa"
  | "vista-comercial"
  | "adicionales"
  | "comision-escolar"
  | "escuela"
  | "operativo"
  | "publicacion"
  | "configuracion";

export type AlbumPublicationPanelId =
  | "compartir"
  | "visibilidad"
  | "proteccion"
  | "portada";

export const ALBUM_PUBLICATION_DEFAULT_PANEL: AlbumPublicationPanelId = "compartir";

export const ALBUM_DASHBOARD_DEFAULT_TAB: AlbumDashboardLegacyTabId = "resumen";

export type AlbumNavResolution = {
  section: AlbumDashboardSectionId;
  legacyTab: AlbumDashboardLegacyTabId;
  legacySubTab?: Exclude<AlbumDashboardLegacyTabId, "resumen" | "configuracion">;
};

const LEGACY_TAB_TO_SECTION: Record<
  AlbumDashboardLegacyTabId,
  Omit<AlbumNavResolution, "legacyTab">
> = {
  resumen: { section: "resumen" },
  fotos: { section: "contenido", legacySubTab: "fotos" },
  videos: { section: "contenido", legacySubTab: "videos" },
  ventas: { section: "venta", legacySubTab: "ventas" },
  packs: { section: "venta", legacySubTab: "packs" },
  preventa: { section: "venta", legacySubTab: "preventa" },
  "vista-comercial": { section: "venta", legacySubTab: "vista-comercial" },
  adicionales: { section: "venta", legacySubTab: "adicionales" },
  "comision-escolar": { section: "venta", legacySubTab: "comision-escolar" },
  escuela: { section: "escuela" },
  operativo: { section: "pedidos" },
  publicacion: { section: "publicacion" },
  configuracion: { section: "configuracion" },
};

export function resolveAlbumNavFromLegacyTab(
  tab: AlbumDashboardLegacyTabId
): AlbumNavResolution {
  const mapped = LEGACY_TAB_TO_SECTION[tab];
  return { ...mapped, legacyTab: tab };
}

export function resolveAlbumNavFromQuery(tab: AlbumDashboardLegacyTabId): AlbumNavResolution {
  return resolveAlbumNavFromLegacyTab(tab);
}

export function sectionLabel(section: AlbumDashboardSectionId): string {
  const labels: Record<AlbumDashboardSectionId, string> = {
    resumen: "Resumen",
    contenido: "Contenido",
    venta: "Venta",
    pedidos: "Pedidos",
    escuela: "Escuela",
    publicacion: "Publicación",
    configuracion: "Configuración",
  };
  return labels[section];
}

/** Áreas visuales del workspace (nivel 1). */
export type AlbumWorkspaceAreaId =
  | "resumen"
  | "contenido"
  | "venta"
  | "publicacion"
  | "pedidos"
  | "configuracion";

export type AlbumWorkspaceSubTab = {
  id: AlbumDashboardLegacyTabId;
  label: string;
  navKey?: string;
  publicationPanel?: AlbumPublicationPanelId;
};

export type AlbumWorkspaceAreaConfig = {
  id: AlbumWorkspaceAreaId;
  label: string;
  subtabs: AlbumWorkspaceSubTab[];
};

export function resolveAlbumWorkspaceAreaFromLegacyTab(
  tab: AlbumDashboardLegacyTabId
): AlbumWorkspaceAreaId {
  if (tab === "publicacion") return "publicacion";
  if (tab === "configuracion") return "configuracion";
  const { section } = resolveAlbumNavFromLegacyTab(tab);
  if (section === "contenido") return "contenido";
  if (section === "venta") return "venta";
  if (section === "escuela" || section === "pedidos") return "pedidos";
  return "resumen";
}

export function buildAlbumWorkspaceNavAreas(opts: {
  videoMvpEnabled: boolean;
  schoolLinked: boolean;
  schoolAlbumMode?: boolean;
  commercialUnifiedUiEnabled?: boolean;
}): AlbumWorkspaceAreaConfig[] {
  const commercialUnifiedUiEnabled =
    opts.commercialUnifiedUiEnabled ?? isAlbumCommercialUnifiedUiEnabled();
  const areas: AlbumWorkspaceAreaConfig[] = [
    {
      id: "resumen",
      label: "Resumen",
      subtabs: [{ id: "resumen", label: "Resumen" }],
    },
    {
      id: "contenido",
      label: "Contenido",
      subtabs: [
        { id: "fotos", label: "Fotos" },
        ...(opts.videoMvpEnabled ? [{ id: "videos" as const, label: "Videos" }] : []),
      ],
    },
    {
      id: "venta",
      label: "Venta",
      subtabs: [
        { id: "ventas", label: albumSalesTypesTabLabel() },
        { id: "packs", label: albumGalleryTabLabel() },
        { id: "preventa", label: albumPreventaTabLabel() },
        ...(commercialUnifiedUiEnabled
          ? [{ id: "vista-comercial" as const, label: "Vista comercial unificada" }]
          : []),
        { id: "adicionales", label: albumExtrasTabLabel() },
        ...(opts.schoolAlbumMode
          ? [{ id: "comision-escolar" as const, label: albumSchoolCommissionTabLabel() }]
          : []),
      ],
    },
    {
      id: "publicacion",
      label: "Publicación",
      subtabs: [
        {
          id: "publicacion",
          navKey: "publicacion-compartir",
          label: "Compartir",
          publicationPanel: "compartir",
        },
        {
          id: "publicacion",
          navKey: "publicacion-visibilidad",
          label: "Visibilidad",
          publicationPanel: "visibilidad",
        },
        {
          id: "publicacion",
          navKey: "publicacion-proteccion",
          label: "Protección",
          publicationPanel: "proteccion",
        },
        {
          id: "publicacion",
          navKey: "publicacion-portada",
          label: "Portada",
          publicationPanel: "portada",
        },
      ],
    },
    {
      id: "configuracion",
      label: "Configuración",
      subtabs: [{ id: "configuracion", label: "General" }],
    },
  ];

  if (opts.schoolLinked) {
    areas.splice(areas.length - 1, 0, {
      id: "pedidos",
      label: "Pedidos/Escuela",
      subtabs: [
        { id: "escuela", label: "Escuela" },
        { id: "operativo", label: "Operativo escolar" },
      ],
    });
  }

  return areas.filter((area) => area.subtabs.length > 0);
}

export function resolveLegacyTabForWorkspaceAreaClick(
  area: AlbumWorkspaceAreaId,
  currentTab: AlbumDashboardLegacyTabId,
  opts: { videoMvpEnabled: boolean; schoolLinked: boolean }
): AlbumDashboardLegacyTabId {
  switch (area) {
    case "resumen":
      return "resumen";
    case "contenido":
      if (currentTab === "fotos") return "fotos";
      if (currentTab === "videos" && opts.videoMvpEnabled) return "videos";
      return "fotos";
    case "venta":
      if (
        currentTab === "ventas" ||
        currentTab === "packs" ||
        currentTab === "preventa" ||
        currentTab === "vista-comercial" ||
        currentTab === "adicionales" ||
        currentTab === "comision-escolar"
      ) {
        return currentTab;
      }
      return "ventas";
    case "publicacion":
      return "publicacion";
    case "configuracion":
      return "configuracion";
    case "pedidos":
      if (currentTab === "escuela" || currentTab === "operativo") return currentTab;
      return "escuela";
    default:
      return ALBUM_DASHBOARD_DEFAULT_TAB;
  }
}

export type ParseLegacyAlbumTabOptions = {
  schoolLinked: boolean;
  schoolAlbumMode?: boolean;
  videoMvpEnabled: boolean;
  commercialUnifiedUiEnabled?: boolean;
};

export function parseLegacyAlbumTabFromQuery(
  raw: string | null,
  opts: ParseLegacyAlbumTabOptions
): AlbumDashboardLegacyTabId | null {
  if (!raw) return null;
  if (raw === "resumen") return "resumen";
  if (raw === "publicacion") return "publicacion";
  if (raw === "configuracion") return "configuracion";
  if (
    raw === "fotos" ||
    raw === "ventas" ||
    raw === "packs" ||
    raw === "preventa" ||
    raw === "adicionales"
  ) {
    return raw;
  }
  if (opts.schoolAlbumMode && raw === "comision-escolar") {
    return "comision-escolar";
  }
  const commercialUnifiedUiEnabled =
    opts.commercialUnifiedUiEnabled ?? isAlbumCommercialUnifiedUiEnabled();
  if (commercialUnifiedUiEnabled && raw === "vista-comercial") {
    return "vista-comercial";
  }
  if (raw === "videos" && opts.videoMvpEnabled) return "videos";
  if (opts.schoolLinked && (raw === "escuela" || raw === "operativo")) {
    return raw;
  }
  return null;
}

export function parsePublicationPanelFromQuery(
  raw: string | null | undefined
): AlbumPublicationPanelId | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (
    lower === "compartir" ||
    lower === "visibilidad" ||
    lower === "proteccion" ||
    lower === "portada"
  ) {
    return lower;
  }
  return null;
}
