import { prisma } from "@repo/db";
import { getSignedFileUrl } from "@/lib/archivos";
import type { GearItemKind } from "@/lib/inventario/tipos";
import type { GearListingCondition } from "./catalogos";
import { findActiveReportsForSerial } from "./denuncia-activa";

/**
 * Ficha de una publicación para el panel admin, en cualquier estado: lo que hace falta para decidir
 * sin aprobar a ciegas (fotos firmadas, foto de la serie, serie completa, denuncias citadas,
 * vendedor). De quien denunció sólo sale su id.
 */

const FIRMA_SEGUNDOS = 900;

export const ESTADOS_DENUNCIA: Record<string, string> = {
  PENDING_REVIEW: "Pendiente de revisión",
  ACTIVE: "Activa",
  REJECTED: "Rechazada",
  RECOVERED: "Recuperado",
  WITHDRAWN: "Retirada",
};

export const TIPOS_DENUNCIA: Record<string, string> = { THEFT: "Robo", LOST: "Pérdida" };

export type DenunciaCitada = {
  id: number;
  incident: string;
  status: string;
  createdAt: Date;
  reporterId: number;
  /** `true` si la cita la nota interna; si no, aparece porque está activa hoy sobre la serie. */
  citada: boolean;
};

export type DetalleAdmin = {
  id: number;
  status: string;
  kind: GearItemKind;
  make: string;
  model: string;
  priceArs: number;
  priceUsdRef: number | null;
  condition: GearListingCondition;
  description: string | null;
  accessories: string | null;
  province: string;
  city: string;
  reviewNote: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  serialRaw: string | null;
  serialNormalized: string | null;
  /** `null` en una posición: esa foto no se pudo firmar («Sin foto»). */
  fotos: (string | null)[];
  /** `undefined`: la publicación no tiene foto de serie; `null`: no se pudo firmar. */
  fotoSerie: string | null | undefined;
  vendedor: { id: number; nombreLegal: string | null; email: string | null };
  denuncias: DenunciaCitada[];
};

/** Números de denuncia citados en la nota interna («Denuncia activa #N»). */
export function denunciasCitadas(note: string | null): number[] {
  const ids = [...(note ?? "").matchAll(/Denuncia activa #(\d+)/g)].map((x) => Number(x[1]));
  return [...new Set(ids)];
}

async function firmar(key: string): Promise<string | null> {
  try {
    return await getSignedFileUrl(key, FIRMA_SEGUNDOS);
  } catch (error) {
    console.error("[admin-publicaciones] No se pudo firmar un archivo", error);
    return null;
  }
}

export async function getListingForAdmin(id: number): Promise<DetalleAdmin | null> {
  const l = await prisma.gearListing.findFirst({
    where: { id },
    select: {
      id: true,
      status: true,
      kind: true,
      make: true,
      model: true,
      priceArs: true,
      priceUsdRef: true,
      condition: true,
      description: true,
      accessories: true,
      province: true,
      city: true,
      reviewNote: true,
      createdAt: true,
      publishedAt: true,
      serialPhotoKey: true,
      sellerId: true,
      seller: { select: { email: true } },
      gearItem: { select: { serialRaw: true, serialNormalized: true, photoKeys: true } },
    },
  });
  if (!l) return null;

  const serial = l.gearItem.serialNormalized;
  const [identidad, activas] = await Promise.all([
    prisma.identityVerification.findUnique({
      where: { userId: l.sellerId },
      select: { legalName: true },
    }),
    serial ? findActiveReportsForSerial(serial, l.sellerId) : Promise.resolve([]),
  ]);

  const citadas = denunciasCitadas(l.reviewNote);
  const ids = [...new Set([...citadas, ...activas.map((a) => a.id)])];
  const filas = ids.length
    ? await prisma.stolenGearReport.findMany({
        where: { id: { in: ids } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        // Del denunciante, sólo el id: nada de nombre, correo ni teléfono.
        select: { id: true, incident: true, status: true, createdAt: true, reporterId: true },
      })
    : [];

  const fotoKeys = l.gearItem.photoKeys.filter((k) => k !== l.serialPhotoKey);
  const [fotos, fotoSerie] = await Promise.all([
    Promise.all(fotoKeys.map(firmar)),
    l.serialPhotoKey ? firmar(l.serialPhotoKey) : Promise.resolve(undefined),
  ]);

  return {
    id: l.id,
    status: l.status,
    kind: l.kind as GearItemKind,
    make: l.make,
    model: l.model,
    priceArs: l.priceArs,
    priceUsdRef: l.priceUsdRef,
    condition: l.condition as GearListingCondition,
    description: l.description,
    accessories: l.accessories,
    province: l.province,
    city: l.city,
    reviewNote: l.reviewNote,
    createdAt: l.createdAt,
    publishedAt: l.publishedAt,
    serialRaw: l.gearItem.serialRaw,
    serialNormalized: serial,
    fotos,
    fotoSerie,
    vendedor: {
      id: l.sellerId,
      nombreLegal: identidad?.legalName?.trim() || null,
      email: l.seller.email,
    },
    denuncias: filas.map((f) => ({
      id: f.id,
      incident: f.incident,
      status: f.status,
      createdAt: f.createdAt,
      reporterId: f.reporterId,
      citada: citadas.includes(f.id),
    })),
  };
}
