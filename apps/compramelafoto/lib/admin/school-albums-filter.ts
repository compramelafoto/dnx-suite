import type { AlbumRow, DetailResponse, PackRow } from "@/components/admin/school-detail/types";

export type SchoolAlbumListFilter =
  | "all"
  | "active"
  | "test"
  | "commission"
  | "stocked"
  | "preventa"
  | "completos";

function isPackInValidityWindow(pack: PackRow, now: Date): boolean {
  if (pack.validFrom) {
    const from = new Date(pack.validFrom);
    if (!Number.isNaN(from.getTime()) && from > now) return false;
  }
  if (pack.validUntil) {
    const until = new Date(pack.validUntil);
    if (!Number.isNaN(until.getTime()) && until < now) return false;
  }
  return true;
}

/** Pack preventa activo: fase PRE, activo, dentro de vigencia y definición no legacy. */
export function albumHasActivePreventaPack(albumId: number, packs: PackRow[]): boolean {
  const now = new Date();
  return packs.some(
    (p) =>
      p.albumId === albumId &&
      p.source === "PACK_DEFINITION" &&
      p.isActive &&
      p.availabilityPhase === "PRE_UPLOAD" &&
      isPackInValidityWindow(p, now)
  );
}

/** Operativo con contenido y al menos un pedido registrado. */
export function isAlbumOperativoCompleto(album: AlbumRow): boolean {
  const m = album.metrics;
  return m.photoCount > 0 && m.studentCount > 0 && m.orderCount > 0;
}

export function filterSchoolAlbumsByTab(detail: DetailResponse, filter: SchoolAlbumListFilter): AlbumRow[] {
  const { albums, packs } = detail;
  switch (filter) {
    case "active":
      return albums.filter((a) => !a.isTest);
    case "test":
      return albums.filter((a) => a.isTest);
    case "commission":
      return albums.filter((a) => a.organizerCommissionEnabled);
    case "stocked":
      return albums.filter((a) => a.metrics.photoCount > 0 && a.metrics.studentCount > 0);
    case "preventa":
      return albums.filter((a) => albumHasActivePreventaPack(a.id, packs));
    case "completos":
      return albums.filter((a) => isAlbumOperativoCompleto(a));
    default:
      return albums;
  }
}
