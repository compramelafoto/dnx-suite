import "server-only";
import { prisma } from "@repo/db";
import { z } from "zod";
import { inicioDelMesArgentino } from "../periodista/horario";

/**
 * Gasto del mes del Buscador (Google Places + Claude) y sus topes. Los topes se editan y viven en
 * `SystemSettings`. El mes se cuenta en hora argentina. El Buscador frena `MARGEN_FRENO_USD`
 * antes del tope, para no pasarse por las llamadas que ya están en vuelo.
 */

export const CLAVE_AJUSTES_BUSCADOR = "fotoffice_buscador_ajustes";
export const MARGEN_FRENO_USD = 2;

export type AjustesBuscador = {
  topeGoogleUsd: number;
  topeClaudeUsd: number;
  pausado: boolean;
  /** Mes argentino ("YYYY-MM") del último aviso por tope, por fuente. */
  avisoTope: { GOOGLE?: string; CLAUDE?: string };
};

/**
 * Sin fila de ajustes el Buscador arranca EN PAUSA: así el cron no empieza a buscar (ni a gastar)
 * apenas se despliega, antes de cargar las claves e importar los conocidos. Se reanuda desde el panel.
 */
export const AJUSTES_POR_OMISION: AjustesBuscador = { topeGoogleUsd: 20, topeClaudeUsd: 30, pausado: true, avisoTope: {} };

const esquemaAjustes = z.object({
  topeGoogleUsd: z.number().finite().min(0),
  topeClaudeUsd: z.number().finite().min(0),
  pausado: z.boolean(),
  avisoTope: z.object({ GOOGLE: z.string().optional(), CLAUDE: z.string().optional() }),
});

/** Lee los ajustes campo por campo: lo válido se conserva (p. ej. `pausado`), sólo lo inválido vuelve al valor por omisión. */
export async function leerAjustes(): Promise<AjustesBuscador> {
  const fila = await prisma.systemSettings.findUnique({ where: { key: CLAVE_AJUSTES_BUSCADOR }, select: { value: true } });
  const base: AjustesBuscador = { ...AJUSTES_POR_OMISION, avisoTope: {} };
  if (!fila?.value) return base;
  let crudo: unknown;
  try {
    crudo = JSON.parse(fila.value);
  } catch {
    return base;
  }
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return base;
  const c = crudo as Record<string, unknown>;
  const tope = (v: unknown, omision: number) => {
    const r = esquemaAjustes.shape.topeGoogleUsd.safeParse(v);
    return r.success ? r.data : omision;
  };
  const aviso = esquemaAjustes.shape.avisoTope.safeParse(c.avisoTope);
  const avisoTope: AjustesBuscador["avisoTope"] = {};
  if (aviso.success) {
    if (aviso.data.GOOGLE !== undefined) avisoTope.GOOGLE = aviso.data.GOOGLE;
    if (aviso.data.CLAUDE !== undefined) avisoTope.CLAUDE = aviso.data.CLAUDE;
  }
  return {
    topeGoogleUsd: tope(c.topeGoogleUsd, base.topeGoogleUsd),
    topeClaudeUsd: tope(c.topeClaudeUsd, base.topeClaudeUsd),
    pausado: typeof c.pausado === "boolean" ? c.pausado : base.pausado,
    avisoTope,
  };
}

/** Guarda mezclando con lo actual (también dentro de `avisoTope`). Lanza si un valor nuevo es inválido. */
export async function guardarAjustes(cambios: Partial<AjustesBuscador>): Promise<void> {
  const actual = await leerAjustes();
  const value = JSON.stringify(
    esquemaAjustes.parse({ ...actual, ...cambios, avisoTope: { ...actual.avisoTope, ...(cambios.avisoTope ?? {}) } }),
  );
  await prisma.systemSettings.upsert({
    where: { key: CLAVE_AJUSTES_BUSCADOR },
    create: { key: CLAVE_AJUSTES_BUSCADOR, value, description: "Topes y pausa del agente Buscador de contactos" },
    update: { value },
  });
}

export type PrecioPlaces = { usdPorMil: number; gratisPorMes: number };

/**
 * Precios de Places API (New), primer tramo (0–100.000 llamadas/mes), en USD.
 * Fuente: https://developers.google.com/maps/billing-and-pricing/pricing, consultada el 2026-11-08
 * (la página no muestra fecha de última actualización). Revisar si Google cambia la tarifa.
 */
export const PRECIOS_PLACES: Record<string, PrecioPlaces> = {
  TEXT_SEARCH_ESSENTIALS_IDS_ONLY: { usdPorMil: 0, gratisPorMes: Number.POSITIVE_INFINITY },
  TEXT_SEARCH_PRO: { usdPorMil: 32, gratisPorMes: 5000 },
  TEXT_SEARCH_ENTERPRISE: { usdPorMil: 35, gratisPorMes: 1000 },
  NEARBY_SEARCH_PRO: { usdPorMil: 32, gratisPorMes: 5000 },
  NEARBY_SEARCH_ENTERPRISE: { usdPorMil: 35, gratisPorMes: 1000 },
  PLACE_DETAILS_ESSENTIALS: { usdPorMil: 5, gratisPorMes: 10000 },
  PLACE_DETAILS_PRO: { usdPorMil: 17, gratisPorMes: 5000 },
  PLACE_DETAILS_ENTERPRISE: { usdPorMil: 20, gratisPorMes: 1000 },
};

/**
 * Costo en USD de UNA llamada: 0 mientras quede cupo gratis del mes. Un SKU desconocido se cobra
 * al precio más alto de la tabla y sin cupo gratis (conservador). `precios` se inyecta en tests.
 */
export function costoLlamadaPlaces(sku: string, llamadasPreviasDelMes: number, precios: Record<string, PrecioPlaces> = PRECIOS_PLACES): number {
  const p = precios[sku] ?? { usdPorMil: Math.max(...Object.values(precios).map((x) => x.usdPorMil)), gratisPorMes: 0 };
  if (llamadasPreviasDelMes < p.gratisPorMes) return 0;
  return p.usdPorMil / 1000;
}

const MICROS = 1_000_000;

export async function gastoDelMes(ahora: Date): Promise<{ googleUsd: number; claudeUsd: number; llamadasPorSku: Record<string, number> }> {
  const inicio = inicioDelMesArgentino(ahora);
  const tareas = await prisma.dnxBuscadorTarea.findMany({
    // Una tarea que gastó y volvió a PENDIENTE/FALLIDA no tiene `hechaEn`: se cuenta por `tomadaEn`.
    where: { OR: [{ hechaEn: { gte: inicio } }, { hechaEn: null, tomadaEn: { gte: inicio } }] },
    select: { costoGoogleUsdMicros: true, costoClaudeUsdMicros: true, resultado: true },
  });
  let google = 0;
  let claude = 0;
  const llamadasPorSku: Record<string, number> = {};
  for (const t of tareas) {
    google += t.costoGoogleUsdMicros;
    claude += t.costoClaudeUsdMicros;
    const llamadas = (t.resultado as { llamadas?: unknown } | null)?.llamadas;
    if (llamadas && typeof llamadas === "object") {
      for (const [sku, n] of Object.entries(llamadas as Record<string, unknown>)) {
        if (typeof n === "number" && Number.isFinite(n)) llamadasPorSku[sku] = (llamadasPorSku[sku] ?? 0) + n;
      }
    }
  }
  return { googleUsd: google / MICROS, claudeUsd: claude / MICROS, llamadasPorSku };
}

export async function puedeUsar(fuente: "GOOGLE" | "CLAUDE", ahora: Date): Promise<{ ok: boolean; motivo?: "PAUSADO" | "TOPE" }> {
  const ajustes = await leerAjustes();
  if (ajustes.pausado) return { ok: false, motivo: "PAUSADO" };
  const gasto = await gastoDelMes(ahora);
  const tope = fuente === "GOOGLE" ? ajustes.topeGoogleUsd : ajustes.topeClaudeUsd;
  const gastado = fuente === "GOOGLE" ? gasto.googleUsd : gasto.claudeUsd;
  // Se compara en micros enteros para que 18,00 frene exacto.
  if (Math.round(gastado * MICROS) >= Math.round((tope - MARGEN_FRENO_USD) * MICROS)) return { ok: false, motivo: "TOPE" };
  return { ok: true };
}
