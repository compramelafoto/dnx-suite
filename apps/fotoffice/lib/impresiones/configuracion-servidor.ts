import "server-only";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puedeCobrarConMercadoPago } from "@/lib/payments/connect/collector";
import { extrasDelWorkspace } from "@/lib/presupuestos/perfil-cobro";
import { parseCuantoCobroAmount } from "@repo/cuanto-cobro-core";
import { PRINT_ORDERS_MODULE_KEY, TAMANOS_INICIALES, type Papel } from "./constantes";
import { coordenadasDelEstudio, type Punto } from "./envio";
import { aCentavos, formatearMontoAr, parsearMontoAr, type TamanoOferta } from "./precios";

/** Envío a domicilio que se le ofrece al cliente. El estudio sale del perfil de precios. */
export type OfertaEnvio = { baseCents: number; porKmCents: number; maxKm: number | null; estudio: Punto };
export type OfertaImpresion = { papeles: Papel[]; tamanos: TamanoOferta[]; envio: OfertaEnvio | null };

type AjustesEnvio = {
  shippingEnabled?: boolean;
  shippingBaseArs?: unknown;
  shippingPerKmArs?: unknown;
  shippingMaxKm?: number | null;
} | null;

/** null si el envío está apagado o el estudio no cargó su ubicación (sin ubicación no hay distancia que medir). */
async function ofertaEnvio(workspaceId: string, s: AjustesEnvio): Promise<OfertaEnvio | null> {
  if (!s?.shippingEnabled) return null;
  const estudio = coordenadasDelEstudio(await extrasDelWorkspace(workspaceId));
  if (!estudio) return null;
  return {
    baseCents: Math.max(0, aCentavos((s.shippingBaseArs ?? null) as never) ?? 0),
    porKmCents: Math.max(0, aCentavos((s.shippingPerKmArs ?? null) as never) ?? 0),
    maxKm: typeof s.shippingMaxKm === "number" && s.shippingMaxKm > 0 ? s.shippingMaxKm : null,
    estudio,
  };
}

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

/**
 * Lo que ve el cliente: papeles encendidos y tamaños activos con precio y con un laboratorio activo (un tamaño
 * sin laboratorio se cobraría y nunca saldría). null = módulo apagado, el estudio no puede cobrar con Mercado
 * Pago, o nada para ofrecer.
 */
export async function ofertaPublica(workspaceId: string): Promise<OfertaImpresion | null> {
  if (!(await isModuleEnabledForWorkspace(workspaceId, PRINT_ORDERS_MODULE_KEY))) return null;
  if (!(await puedeCobrarConMercadoPago(workspaceId))) return null;
  const [ajustes, filas] = await Promise.all([
    prisma.fotofficePrintSettings.findUnique({ where: { workspaceId } }),
    prisma.fotofficePrintSize.findMany({
      where: { workspaceId, active: true, proveedorId: { not: null }, proveedor: { active: true } },
      orderBy: [{ order: "asc" }, { widthCm: "asc" }],
    }),
  ]);
  const tamanos = (filas as FilaTamano[]).map(aOferta).filter((t): t is TamanoOferta => t !== null);
  const papeles = papelesDe(ajustes);
  if (tamanos.length === 0 || papeles.length === 0) return null;
  return { papeles, tamanos, envio: await ofertaEnvio(workspaceId, ajustes) };
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
  return parsearMontoAr(String(v)) ?? "malo";
};

const ERR_TAMANO = "Uno de los tamaños ya no existe. Recargá la página.";

export async function guardarTamanos(workspaceId: string, filas: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Array.isArray(filas)) return { ok: false, error: "Datos inválidos." };
  const cambios: { id: string; costArs: number | null; priceArs: number | null; proveedorId: string | null; active: boolean }[] = [];
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
  if (cambios.some((c) => c.priceArs !== null && c.proveedorId === null)) {
    return { ok: false, error: "Elegí un laboratorio para cada tamaño con precio." };
  }
  // Los laboratorios elegidos tienen que ser de este estudio.
  const proveedorIds = [...new Set(cambios.map((c) => c.proveedorId).filter((x): x is string => x !== null))];
  if (proveedorIds.length > 0) {
    const propios = await prisma.fotofficeProveedor.findMany({ where: { id: { in: proveedorIds }, workspaceId }, select: { id: true } });
    if (propios.length !== proveedorIds.length) return { ok: false, error: "Uno de los laboratorios no es de tu estudio." };
  }
  // Todo o nada: si un tamaño no existe (o es de otro estudio), no se guarda ninguno.
  try {
    await prisma.$transaction(async (tx) => {
      for (const c of cambios) {
        const r = await tx.fotofficePrintSize.updateMany({
          where: { id: c.id, workspaceId },
          data: { costArs: c.costArs, priceArs: c.priceArs, proveedorId: c.proveedorId, active: c.active },
        });
        if (r.count === 0) throw new Error(ERR_TAMANO);
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === ERR_TAMANO) return { ok: false, error: ERR_TAMANO };
    throw e;
  }
  return { ok: true };
}

export type AjustesImpresion = {
  encendido: boolean;
  testMode: boolean;
  papeles: Papel[];
  circuitId: string | null;
  /** Montos en formato es-AR para los campos. `porKmArs` propone el precio por km del perfil si está vacío. */
  envio: { encendido: boolean; baseArs: string; porKmArs: string; maxKm: string; estudioUbicado: boolean };
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
  const [encendido, s, filas, extras] = await Promise.all([
    isModuleEnabledForWorkspace(workspaceId, PRINT_ORDERS_MODULE_KEY),
    prisma.fotofficePrintSettings.findUnique({ where: { workspaceId } }),
    prisma.fotofficePrintSize.findMany({ where: { workspaceId }, orderBy: [{ order: "asc" }], include: { proveedor: { select: { name: true } } } }),
    extrasDelWorkspace(workspaceId),
  ]);
  const porKmPerfil = extras?.travelPerKm ? parseCuantoCobroAmount(extras.travelPerKm) : null;
  const porKmArs = formatearMontoAr((s?.shippingPerKmArs ?? null) as never) || formatearMontoAr(porKmPerfil);
  return {
    encendido,
    testMode: s?.testMode ?? true,
    papeles: papelesDe(s),
    circuitId: s?.circuitId ?? null,
    envio: {
      encendido: s?.shippingEnabled ?? false,
      baseArs: formatearMontoAr((s?.shippingBaseArs ?? null) as never),
      porKmArs,
      maxKm: s?.shippingMaxKm ? String(s.shippingMaxKm) : "",
      estudioUbicado: coordenadasDelEstudio(extras) !== null,
    },
    tamanos: filas.map((t) => ({
      id: t.id,
      widthCm: Number(t.widthCm),
      heightCm: Number(t.heightCm),
      proveedorId: t.proveedorId,
      proveedorNombre: t.proveedor?.name ?? null,
      costArs: formatearMontoAr(t.costArs),
      priceArs: formatearMontoAr(t.priceArs),
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
  const shippingEnabled = r.shippingEnabled === true;
  const shippingBaseArs = monto(r.shippingBaseArs);
  const shippingPerKmArs = monto(r.shippingPerKmArs);
  if (shippingBaseArs === "malo" || shippingPerKmArs === "malo") return { ok: false, error: "Revisá los montos del envío: tienen que ser números positivos." };
  const maxTexto = r.shippingMaxKm === null || r.shippingMaxKm === undefined ? "" : String(r.shippingMaxKm).trim();
  if (maxTexto !== "" && !/^\d{1,4}$/.test(maxTexto)) return { ok: false, error: "La distancia máxima tiene que ser un número entero de kilómetros." };
  const shippingMaxKm = maxTexto === "" || Number(maxTexto) === 0 ? null : Number(maxTexto);
  if (shippingEnabled && !coordenadasDelEstudio(await extrasDelWorkspace(workspaceId))) {
    return { ok: false, error: "Cargá la ubicación de tu estudio en Configuración → Precios para ofrecer envíos." };
  }
  const data = { testMode: r.testMode === true, paperGlossy, paperMatte, circuitId, shippingEnabled, shippingBaseArs, shippingPerKmArs, shippingMaxKm };
  await prisma.fotofficePrintSettings.upsert({ where: { workspaceId }, create: { workspaceId, ...data }, update: data });
  return { ok: true };
}
