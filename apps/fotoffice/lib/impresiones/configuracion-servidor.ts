import "server-only";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { PRINT_ORDERS_MODULE_KEY, TAMANOS_INICIALES, type Papel } from "./constantes";
import { aCentavos, type TamanoOferta } from "./precios";

const papelesDe = (s: { paperGlossy: boolean; paperMatte: boolean } | null): Papel[] => [
  ...((s?.paperGlossy ?? true) ? (["BRILLO"] as const) : []),
  ...((s?.paperMatte ?? true) ? (["MATE"] as const) : []),
];

type FilaTamano = {
  id: string;
  widthCm: unknown;
  heightCm: unknown;
  proveedorId: string | null;
  priceArs: unknown;
  costArs: unknown;
  active: boolean;
};

const aOferta = (t: FilaTamano): TamanoOferta | null => {
  const priceCents = aCentavos(t.priceArs as never);
  if (priceCents === null || priceCents <= 0) return null;
  return {
    id: t.id,
    widthCm: Number(t.widthCm),
    heightCm: Number(t.heightCm),
    proveedorId: t.proveedorId,
    priceCents,
    costCents: aCentavos(t.costArs as never) ?? 0,
  };
};

/** Lo que ve el cliente: papeles encendidos y tamaños activos con precio. null = módulo apagado o nada para ofrecer. */
export async function ofertaPublica(workspaceId: string): Promise<{ papeles: Papel[]; tamanos: TamanoOferta[] } | null> {
  if (!(await isModuleEnabledForWorkspace(workspaceId, PRINT_ORDERS_MODULE_KEY))) return null;
  const [ajustes, filas] = await Promise.all([
    prisma.fotofficePrintSettings.findUnique({ where: { workspaceId } }),
    prisma.fotofficePrintSize.findMany({ where: { workspaceId, active: true }, orderBy: [{ order: "asc" }, { widthCm: "asc" }] }),
  ]);
  const tamanos = (filas as FilaTamano[]).map(aOferta).filter((t): t is TamanoOferta => t !== null);
  const papeles = papelesDe(ajustes);
  if (tamanos.length === 0 || papeles.length === 0) return null;
  return { papeles, tamanos };
}

/** Carga la lista inicial de tamaños la primera vez (idempotente). Asocia el laboratorio por nombre. */
export async function sembrarTamanos(workspaceId: string): Promise<void> {
  if ((await prisma.fotofficePrintSize.count({ where: { workspaceId } })) > 0) return;
  const proveedores = await prisma.fotofficeProveedor.findMany({ where: { workspaceId }, select: { id: true, name: true } });
  const porNombre = new Map(proveedores.map((p) => [p.name.trim().toLowerCase(), p.id]));
  await prisma.fotofficePrintSize.createMany({
    data: TAMANOS_INICIALES.map((t, i) => ({
      workspaceId,
      widthCm: t.widthCm,
      heightCm: t.heightCm,
      proveedorId: porNombre.get(t.proveedor.toLowerCase()) ?? null,
      order: i,
      active: true,
    })),
    skipDuplicates: true,
  });
}

const monto = (v: unknown): number | null | "malo" => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : "malo";
};

export async function guardarTamanos(workspaceId: string, filas: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Array.isArray(filas)) return { ok: false, error: "Datos inválidos." };
  const cambios = [];
  for (const f of filas as Record<string, unknown>[]) {
    const cost = monto(f.costArs);
    const price = monto(f.priceArs);
    if (cost === "malo" || price === "malo") return { ok: false, error: "Revisá los montos: tienen que ser números positivos." };
    if (typeof f.id !== "string") return { ok: false, error: "Datos inválidos." };
    cambios.push({
      id: f.id,
      costArs: cost,
      priceArs: price,
      proveedorId: typeof f.proveedorId === "string" && f.proveedorId ? f.proveedorId : null,
      active: f.active === true,
    });
  }
  for (const c of cambios) {
    await prisma.fotofficePrintSize.update({
      where: { id: c.id, workspaceId },
      data: { costArs: c.costArs, priceArs: c.priceArs, proveedorId: c.proveedorId, active: c.active },
    });
  }
  return { ok: true };
}

export type AjustesImpresion = {
  encendido: boolean;
  testMode: boolean;
  papeles: Papel[];
  circuitId: string | null;
  tamanos: {
    id: string;
    widthCm: number;
    heightCm: number;
    proveedorId: string | null;
    proveedorNombre: string | null;
    costArs: string;
    priceArs: string;
    active: boolean;
  }[];
};

export async function leerAjustes(workspaceId: string): Promise<AjustesImpresion> {
  await sembrarTamanos(workspaceId);
  const [encendido, s, filas] = await Promise.all([
    isModuleEnabledForWorkspace(workspaceId, PRINT_ORDERS_MODULE_KEY),
    prisma.fotofficePrintSettings.findUnique({ where: { workspaceId } }),
    prisma.fotofficePrintSize.findMany({ where: { workspaceId }, orderBy: [{ order: "asc" }], include: { proveedor: { select: { name: true } } } }),
  ]);
  return {
    encendido,
    testMode: s?.testMode ?? true,
    papeles: papelesDe(s),
    circuitId: s?.circuitId ?? null,
    tamanos: filas.map((t) => ({
      id: t.id,
      widthCm: Number(t.widthCm),
      heightCm: Number(t.heightCm),
      proveedorId: t.proveedorId,
      proveedorNombre: t.proveedor?.name ?? null,
      costArs: t.costArs?.toString() ?? "",
      priceArs: t.priceArs?.toString() ?? "",
      active: t.active,
    })),
  };
}

export async function guardarAjustes(workspaceId: string, raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const paperGlossy = r.paperGlossy === true;
  const paperMatte = r.paperMatte === true;
  if (!paperGlossy && !paperMatte) return { ok: false, error: "Dejá al menos un papel encendido." };
  const circuitId = typeof r.circuitId === "string" && r.circuitId ? r.circuitId : null;
  const data = { testMode: r.testMode === true, paperGlossy, paperMatte, circuitId };
  await prisma.fotofficePrintSettings.upsert({ where: { workspaceId }, create: { workspaceId, ...data }, update: data });
  return { ok: true };
}
