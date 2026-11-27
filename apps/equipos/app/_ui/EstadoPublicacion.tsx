import type { GearListing } from "@/lib/publicaciones/catalogos";

export type GearListingStatus = GearListing["status"];

const ESTADOS: Record<GearListingStatus, { texto: string; clase: string }> = {
  DRAFT: { texto: "Borrador", clase: "estado" },
  IN_REVIEW: { texto: "En revisión", clase: "estado estado-revision" },
  PUBLISHED: { texto: "Publicada", clase: "estado estado-publicada" },
  PAUSED: { texto: "Pausada", clase: "estado" },
  SOLD: { texto: "Vendida", clase: "estado estado-vendida" },
  CLOSED: { texto: "Cerrada", clase: "estado" },
};

export function EstadoPublicacion({ status }: { status: GearListingStatus }) {
  const e = ESTADOS[status];
  return <span className={e.clase}>{e.texto}</span>;
}
