import "server-only";
import { prisma, type Prisma } from "@repo/db";
import type { CuantoCobroPaymentOptionsInput } from "@/lib/pedidos/opciones-pago";
import { MENSAJES_PRESUPUESTO, puedeConfigurarPresupuestos, type CtxPresupuestos } from "./acceso";
import { SEGUIMIENTO_POR_OMISION_DIAS, VALIDEZ_POR_OMISION_DIAS } from "./constantes";
import { entradaGuardada, validarOpcionesPago } from "./opciones-pago";

/**
 * Ajustes de presupuestos (Configuración → Presupuestos, spec §3.4): una fila por organización.
 * Sin fila valen los de fábrica: 15 días de validez, sin textos, seguimiento a 3 días apagado (el
 * seguimiento automático llega en la Entrega B).
 *
 * Los límites son los mismos que los CHECK del SQL: validez 1–365 y seguimiento 1–90.
 */
export type AjustesPresupuestos = {
  validezDias: number;
  condiciones: string | null;
  propuestaPago: string | null;
  seguimientoDias: number;
  seguimientoActivo: boolean;
  /**
   * Opciones de pago de la organización (etapa 3). null: nunca se guardaron; igual que sin contado
   * ni planes, el presupuesto ofrece la de omisión (`opcionesParaPresupuesto`).
   */
  opcionesPago: CuantoCobroPaymentOptionsInput | null;
};

export const AJUSTES_DE_FABRICA: AjustesPresupuestos = {
  validezDias: VALIDEZ_POR_OMISION_DIAS,
  condiciones: null,
  propuestaPago: null,
  seguimientoDias: SEGUIMIENTO_POR_OMISION_DIAS,
  seguimientoActivo: false,
  opcionesPago: null,
};

export const MAX_TEXTO_AJUSTES = 4000;

type Lector = { fotofficePresupuestoAjustes: Pick<typeof prisma.fotofficePresupuestoAjustes, "findUnique"> };

export async function leerAjustes(workspaceId: string, cliente: Lector = prisma): Promise<AjustesPresupuestos> {
  const f = await cliente.fotofficePresupuestoAjustes.findUnique({
    where: { workspaceId },
    select: { validityDays: true, terms: true, paymentProposal: true, followUpDays: true, followUpEnabled: true, paymentOptions: true },
  });
  if (!f) return { ...AJUSTES_DE_FABRICA };
  return {
    validezDias: f.validityDays,
    condiciones: f.terms,
    propuestaPago: f.paymentProposal,
    seguimientoDias: f.followUpDays,
    seguimientoActivo: f.followUpEnabled,
    opcionesPago: entradaGuardada(f.paymentOptions),
  };
}

function entero(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function texto(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (t.length > MAX_TEXTO_AJUSTES) return undefined;
  return t === "" ? null : t;
}

export type ResultadoAjustes = { ok: true } | { ok: false; error: string };

/**
 * Guarda los ajustes. Exige `configurar`. `opcionesPago` es opcional: si no viene, las opciones de
 * pago guardadas no se tocan; si viene, se valida con `validarOpcionesPago`.
 */
export async function guardarAjustes(ctx: CtxPresupuestos, datos: unknown): Promise<ResultadoAjustes> {
  if (!puedeConfigurarPresupuestos(ctx)) return { ok: false, error: MENSAJES_PRESUPUESTO.sinPermisoAjustes };
  if (!datos || typeof datos !== "object") return { ok: false, error: MENSAJES_PRESUPUESTO.datosInvalidos };
  const d = datos as Record<string, unknown>;
  const validityDays = entero(d.validezDias, 1, 365);
  if (validityDays === null) return { ok: false, error: "La validez tiene que ser de 1 a 365 días." };
  const followUpDays = entero(d.seguimientoDias, 1, 90);
  if (followUpDays === null) return { ok: false, error: "El seguimiento tiene que ser de 1 a 90 días." };
  if (typeof d.seguimientoActivo !== "boolean") return { ok: false, error: MENSAJES_PRESUPUESTO.datosInvalidos };
  const terms = texto(d.condiciones);
  const paymentProposal = texto(d.propuestaPago);
  if (terms === undefined || paymentProposal === undefined) return { ok: false, error: MENSAJES_PRESUPUESTO.texto };

  let paymentOptions: Prisma.InputJsonValue | undefined;
  if (d.opcionesPago !== undefined) {
    const anteriores = await prisma.fotofficePresupuestoAjustes.findUnique({ where: { workspaceId: ctx.workspaceId }, select: { paymentOptions: true } });
    const o = validarOpcionesPago(d.opcionesPago, entradaGuardada(anteriores?.paymentOptions));
    if (!o.ok) return o;
    paymentOptions = o.valor as unknown as Prisma.InputJsonValue;
  }

  const valores = {
    validityDays, terms, paymentProposal, followUpDays, followUpEnabled: d.seguimientoActivo,
    ...(paymentOptions !== undefined ? { paymentOptions } : {}),
  };
  try {
    await prisma.fotofficePresupuestoAjustes.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: { workspaceId: ctx.workspaceId, ...valores },
      update: valores,
      select: { id: true },
    });
  } catch (e) {
    // Dos pestañas guardaron la primera vez a la vez: el único frena a una; gana la última.
    if ((e as { code?: unknown } | null)?.code !== "P2002") throw e;
    await prisma.fotofficePresupuestoAjustes.updateMany({ where: { workspaceId: ctx.workspaceId }, data: valores });
  }
  return { ok: true };
}
