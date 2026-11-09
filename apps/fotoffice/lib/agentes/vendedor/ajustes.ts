import "server-only";
import { prisma } from "@repo/db";
import { z } from "zod";
import { MARGEN_FRENO_USD } from "../buscador/gasto";
import { inicioDelMesArgentino } from "../periodista/horario";
import type { MotivoGasto } from "./tipos";

/**
 * Ajustes y gasto del agente Vendedor. Los ajustes viven en `SystemSettings`; el gasto de Claude, en
 * `DnxVendedorGasto` (propio y aparte del Buscador). El mes se cuenta en hora argentina.
 */

export const CLAVE_AJUSTES_VENDEDOR = "fotoffice_vendedor_ajustes";

export type AjustesVendedor = {
  pausado: boolean;
  pausadoPor: "MANUAL" | "SALUD" | null;
  topeClaudeUsd: number;
  correosPorDia: number;
  correosPrimeraSemana: number;
  /** Día argentino ("YYYY-MM-DD") del primer «Reanudar». */
  arrancoEn: string | null;
  /** ISO desde cuando la salud está mal. */
  saludDesde: string | null;
  /** Mes argentino ("YYYY-MM") del último aviso por tope. */
  avisoTope: string | null;
  consultaClfDia: string | null;
  resumenDia: string | null;
  informeMes: string | null;
  paginaClubesPublicada: boolean;
  soloContactoPrueba: string | null;
};

/** Sin fila de ajustes el Vendedor arranca EN PAUSA. */
export const AJUSTES_VENDEDOR_POR_OMISION: AjustesVendedor = {
  pausado: true,
  pausadoPor: null,
  topeClaudeUsd: 30,
  correosPorDia: 20,
  correosPrimeraSemana: 10,
  arrancoEn: null,
  saludDesde: null,
  avisoTope: null,
  consultaClfDia: null,
  resumenDia: null,
  informeMes: null,
  paginaClubesPublicada: false,
  soloContactoPrueba: null,
};

const cantidad = z.number().finite().min(0);
const texto = z.string().nullable();
const esquemas = {
  pausado: z.boolean(),
  pausadoPor: z.enum(["MANUAL", "SALUD"]).nullable(),
  topeClaudeUsd: cantidad,
  correosPorDia: cantidad,
  correosPrimeraSemana: cantidad,
  arrancoEn: texto,
  saludDesde: texto,
  avisoTope: texto,
  consultaClfDia: texto,
  resumenDia: texto,
  informeMes: texto,
  paginaClubesPublicada: z.boolean(),
  soloContactoPrueba: texto,
} satisfies { [K in keyof AjustesVendedor]: z.ZodType<AjustesVendedor[K]> };
const esquemaAjustes = z.object(esquemas);

/** Lee campo por campo: lo válido se conserva y sólo lo inválido vuelve al valor por omisión. */
export async function leerAjustesVendedor(): Promise<AjustesVendedor> {
  const fila = await prisma.systemSettings.findUnique({ where: { key: CLAVE_AJUSTES_VENDEDOR }, select: { value: true } });
  const resultado: AjustesVendedor = { ...AJUSTES_VENDEDOR_POR_OMISION };
  if (!fila?.value) return resultado;
  let crudo: unknown;
  try {
    crudo = JSON.parse(fila.value);
  } catch {
    return resultado;
  }
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return resultado;
  const c = crudo as Record<string, unknown>;
  const destino = resultado as Record<string, unknown>;
  for (const campo of Object.keys(esquemas) as (keyof AjustesVendedor)[]) {
    const r = esquemas[campo].safeParse(c[campo]);
    if (r.success) destino[campo] = r.data;
  }
  return resultado;
}

/** Guarda mezclando con lo actual. Lanza si un valor nuevo es inválido. */
export async function guardarAjustesVendedor(a: Partial<AjustesVendedor>): Promise<void> {
  const actual = await leerAjustesVendedor();
  const value = JSON.stringify(esquemaAjustes.parse({ ...actual, ...a }));
  await prisma.systemSettings.upsert({
    where: { key: CLAVE_AJUSTES_VENDEDOR },
    create: { key: CLAVE_AJUSTES_VENDEDOR, value, description: "Ajustes, tope y pausa del agente Vendedor" },
    update: { value },
  });
}

/**
 * Reclama un aviso programado (resumen o informe) con un compare-and-set sobre la fila de ajustes: lee
 * el valor guardado, comprueba `toca` y escribe sólo si la fila sigue igual a lo leído. Devuelve
 * `true` sólo para UNA de las corridas que compiten; la que gana es la única que debe enviar.
 */
export async function reclamarAjusteVendedor(a: Partial<AjustesVendedor>, toca: (actual: AjustesVendedor) => boolean): Promise<boolean> {
  const fila = await prisma.systemSettings.findUnique({ where: { key: CLAVE_AJUSTES_VENDEDOR }, select: { value: true } });
  const actual = await leerAjustesVendedor();
  if (!toca(actual)) return false;
  const value = JSON.stringify(esquemaAjustes.parse({ ...actual, ...a }));
  if (!fila) {
    try {
      await prisma.systemSettings.create({ data: { key: CLAVE_AJUSTES_VENDEDOR, value, description: "Ajustes, tope y pausa del agente Vendedor" } });
      return true;
    } catch {
      return false;
    }
  }
  const r = await prisma.systemSettings.updateMany({ where: { key: CLAVE_AJUSTES_VENDEDOR, value: fila.value }, data: { value } });
  return r.count === 1;
}

const MICROS = 1_000_000;

/** Anota un gasto de Claude. No crea fila si el costo da 0. */
export async function anotarGasto(g: { usd: number; motivo: MotivoGasto; hiloId?: string; modeloId?: string }): Promise<void> {
  const usdMicros = Math.round(g.usd * MICROS);
  if (!Number.isFinite(usdMicros) || usdMicros <= 0) return;
  await prisma.dnxVendedorGasto.create({
    data: { usdMicros, motivo: g.motivo, hiloId: g.hiloId ?? null, modeloId: g.modeloId ?? null },
  });
}

/** Lo gastado en el mes argentino de `ahora`, en USD. */
export async function gastoDelMesVendedor(ahora: Date): Promise<number> {
  const filas = await prisma.dnxVendedorGasto.findMany({
    where: { creadoEn: { gte: inicioDelMesArgentino(ahora) } },
    select: { usdMicros: true },
  });
  return filas.reduce((s: number, f: { usdMicros: number }) => s + f.usdMicros, 0) / MICROS;
}

/** Frena `MARGEN_FRENO_USD` antes del tope. Se compara en micros enteros para que 28,00 frene exacto. */
export async function puedeGastar(ahora: Date): Promise<{ ok: true } | { ok: false; motivo: "TOPE" }> {
  const [ajustes, gastado] = await Promise.all([leerAjustesVendedor(), gastoDelMesVendedor(ahora)]);
  if (Math.round(gastado * MICROS) >= Math.round((ajustes.topeClaudeUsd - MARGEN_FRENO_USD) * MICROS)) return { ok: false, motivo: "TOPE" };
  return { ok: true };
}
