import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString, parseArsToMinor } from "@/lib/membership/money";
import { MENSAJES_INFORMES as M, puedeConfigurarInformes, type CtxInformes } from "./acceso";

/**
 * Ajustes de Informes (`FotofficeInformesAjustes`): una fila por organización. Sin fila valen los de
 * fábrica. Los importes viajan en centavos enteros; se guardan como `Decimal(14,2)`.
 */
export type AjustesInformes = {
  /** Saldo mínimo de Caja para el flujo proyectado; `null` = sin mínimo. */
  minBalanceCentavos: number | null;
  /** Categoría del monotributo (texto libre, hasta 20); `null` = sin cargar. */
  monotributoCategory: string | null;
  /** Tope anual del monotributo; `null` = sin configurar. */
  monotributoCapCentavos: number | null;
  /** Porcentaje de aviso (50 a 99). */
  monotributoWarnPct: number;
};

export const AJUSTES_INFORMES_DE_FABRICA: AjustesInformes = {
  minBalanceCentavos: null,
  monotributoCategory: null,
  monotributoCapCentavos: null,
  monotributoWarnPct: 80,
};

export const AVISO_MIN_PCT = 50;
export const AVISO_MAX_PCT = 99;
export const MAX_CATEGORIA_MONOTRIBUTO = 20;
/** Tope de un importe: lo que entra en un `Decimal(14,2)`. */
export const MAX_IMPORTE_CENTAVOS = 99_999_999_999_999;

export type ResultadoAjustesInformes = { ok: true } | { ok: false; error: string };

export async function leerAjustesInformes(workspaceId: string): Promise<AjustesInformes> {
  const f = await prisma.fotofficeInformesAjustes.findUnique({
    where: { workspaceId },
    select: { minBalanceArs: true, monotributoCategory: true, monotributoCapArs: true, monotributoWarnPct: true },
  });
  if (!f) return { ...AJUSTES_INFORMES_DE_FABRICA };
  return {
    minBalanceCentavos: f.minBalanceArs === null ? null : decimalArsToMinor(f.minBalanceArs),
    monotributoCategory: f.monotributoCategory,
    monotributoCapCentavos: f.monotributoCapArs === null ? null : decimalArsToMinor(f.monotributoCapArs),
    monotributoWarnPct: f.monotributoWarnPct,
  };
}

/** Importe opcional en pesos (texto "3.000,50" o número) → centavos; `null` si viene vacío; `undefined` si es inválido. */
function importeOpcional(v: unknown): number | null | undefined {
  if (v === null || v === undefined) return null;
  let centavos: number | null;
  if (typeof v === "number") centavos = Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
  else if (typeof v === "string") {
    if (v.trim() === "") return null;
    centavos = parseArsToMinor(v);
  } else return undefined;
  if (centavos === null || !Number.isSafeInteger(centavos) || centavos > MAX_IMPORTE_CENTAVOS) return undefined;
  return centavos;
}

function porcentaje(v: unknown): number | null {
  if (v === null || v === undefined) return AJUSTES_INFORMES_DE_FABRICA.monotributoWarnPct;
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= AVISO_MIN_PCT && n <= AVISO_MAX_PCT ? n : null;
}

/**
 * Guarda los ajustes (`upsert` por workspace). Exige `configurar`. Entrada: `minBalanceArs`,
 * `monotributoCapArs` (pesos, texto o número, vacío = sin configurar), `monotributoCategory`
 * (vacía = sin cargar) y `monotributoWarnPct` (sin dato = 80).
 */
export async function guardarAjustesInformes(ctx: CtxInformes, datos: unknown): Promise<ResultadoAjustesInformes> {
  if (!puedeConfigurarInformes(ctx)) return { ok: false, error: M.sinPermiso };
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return { ok: false, error: M.datosInvalidos };
  const d = datos as Record<string, unknown>;

  const minimo = importeOpcional(d.minBalanceArs);
  if (minimo === undefined) return { ok: false, error: M.minimo };
  const tope = importeOpcional(d.monotributoCapArs);
  if (tope === undefined || tope === 0) return { ok: false, error: M.tope };
  const pct = porcentaje(d.monotributoWarnPct);
  if (pct === null) return { ok: false, error: M.aviso };

  let categoria: string | null = null;
  if (d.monotributoCategory !== null && d.monotributoCategory !== undefined) {
    if (typeof d.monotributoCategory !== "string") return { ok: false, error: M.categoria };
    const t = d.monotributoCategory.trim();
    if (t.length > MAX_CATEGORIA_MONOTRIBUTO) return { ok: false, error: M.categoria };
    categoria = t === "" ? null : t;
  }

  const valores = {
    minBalanceArs: minimo === null ? null : minorToDecimalString(minimo),
    monotributoCategory: categoria,
    monotributoCapArs: tope === null ? null : minorToDecimalString(tope),
    monotributoWarnPct: pct,
  };
  const workspaceId = ctx.workspaceId;
  try {
    try {
      await prisma.fotofficeInformesAjustes.upsert({
        where: { workspaceId },
        create: { workspaceId, ...valores },
        update: valores,
        select: { id: true },
      });
    } catch (e) {
      // Dos pestañas guardaron la primera vez a la vez: el único frena a una; gana la última.
      if ((e as { code?: unknown } | null)?.code !== "P2002") throw e;
      await prisma.fotofficeInformesAjustes.updateMany({ where: { workspaceId }, data: valores });
    }
  } catch (e) {
    console.error("[informes] guardar ajustes falló", { codigo: typeof (e as { code?: unknown } | null)?.code === "string" ? (e as { code: string }).code : null });
    return { ok: false, error: M.fallo };
  }
  return { ok: true };
}
