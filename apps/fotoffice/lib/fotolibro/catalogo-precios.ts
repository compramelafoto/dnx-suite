import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { leerTramos } from "@/lib/precios-proveedor/redondeo";
import { margenValido } from "@/lib/precios-proveedor/margen";
import { MARGEN_FOTOLIBRO_POR_OMISION, type CatalogoFotolibro, type OfertaFotolibro, type PiezaFotolibro } from "./cotizar";

/**
 * Lo que la calculadora de fotolibros necesita: tapas, hojas y cajas de la última lista
 * APLICADA de cada proveedor, el margen de fotolibros y el redondeo del workspace.
 * `conCostos` = quien llama puede ver costos (`sales.catalog`); si no, sólo viajan precios.
 */

export type AjustesFotolibro = { marginPct: number; fotosPorHoja: Record<string, number> };

function leerFotosPorHoja(raw: Prisma.JsonValue | null | undefined): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 200) out[k] = v;
  return out;
}

export async function leerAjustesFotolibro(workspaceId: string): Promise<AjustesFotolibro & { tramos: ReturnType<typeof leerTramos> }> {
  const r = await prisma.fotofficeReglaPrecios.findUnique({
    where: { workspaceId },
    select: { redondeo: true, fotolibroMarginPct: true, fotolibroFotosPorHoja: true },
  });
  return {
    marginPct: r?.fotolibroMarginPct != null ? Number(r.fotolibroMarginPct.toString()) : MARGEN_FOTOLIBRO_POR_OMISION,
    fotosPorHoja: leerFotosPorHoja(r?.fotolibroFotosPorHoja),
    tramos: leerTramos(r?.redondeo ?? null),
  };
}

export async function guardarAjustesFotolibro(
  workspaceId: string,
  a: AjustesFotolibro,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!margenValido(a.marginPct) || a.marginPct < 0) return { ok: false, error: "El margen de fotolibros no se entiende." };
  const fotos = leerFotosPorHoja(a.fotosPorHoja as Prisma.JsonValue);
  const actual = await prisma.fotofficeReglaPrecios.findUnique({ where: { workspaceId }, select: { redondeo: true } });
  const datos = { fotolibroMarginPct: a.marginPct.toFixed(2), fotolibroFotosPorHoja: fotos };
  await prisma.fotofficeReglaPrecios.upsert({
    where: { workspaceId },
    // La fila nace con los tramos por omisión (`leerTramos` de null).
    create: { workspaceId, redondeo: (actual?.redondeo ?? leerTramos(null)) as unknown as Prisma.InputJsonValue, ...datos },
    update: datos,
  });
  return { ok: true };
}

export async function leerCatalogoFotolibro(workspaceId: string, opts: { conCostos: boolean }): Promise<CatalogoFotolibro | null> {
  const [ajustes, listas] = await Promise.all([
    leerAjustesFotolibro(workspaceId),
    prisma.fotofficeListaProveedor.findMany({
      where: { workspaceId, estado: "APLICADA", proveedor: { active: true }, items: { some: { tipo: { in: ["TAPA", "HOJA"] } } } },
      orderBy: [{ proveedorId: "asc" }, { aplicadaAt: "desc" }],
      distinct: ["proveedorId"],
      select: {
        proveedorId: true,
        vigencia: true,
        proveedor: { select: { name: true } },
        items: { where: { tipo: { in: ["TAPA", "HOJA", "CAJA"] }, medida: { not: null } }, select: { tipo: true, modelo: true, medida: true, costoArs: true } },
      },
    }),
  ]);
  const factor = 1 + ajustes.marginPct / 100;
  const ofertas: OfertaFotolibro[] = listas
    .map((l) => {
      const piezas = (tipo: string): PiezaFotolibro[] =>
        l.items
          .filter((i) => i.tipo === tipo)
          .map((i) => {
            const costo = decimalArsToMinor(i.costoArs);
            return { medida: i.medida!, modelo: i.modelo, baseMinor: costo * factor, costoMinor: opts.conCostos ? costo : null };
          });
      return { proveedorId: l.proveedorId, proveedor: l.proveedor.name, vigencia: l.vigencia, tapas: piezas("TAPA"), hojas: piezas("HOJA"), cajas: piezas("CAJA") };
    })
    .filter((o) => o.hojas.length > 0)
    .sort((a, b) => a.proveedor.localeCompare(b.proveedor, "es"));
  if (ofertas.length === 0) return null;
  return { ofertas, tramos: ajustes.tramos, fotosPorHoja: ajustes.fotosPorHoja, marginPct: ajustes.marginPct };
}
