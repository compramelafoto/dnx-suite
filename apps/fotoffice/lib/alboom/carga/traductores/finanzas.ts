import { campos, fecha, idAlboom, siNo, texto, textoLargo } from "../normalizar";
import type { Campos, Crudo, Decision, EntradaMapa } from "../tipos";
import { DUDAS_8B2, MOTIVOS_8B2, importeConSigno, instanteAr, medioDePago, padreDe, yaCargado } from "./historia";

/**
 * Finanzas de Alboom (`account_trans`, doc 04 §21) → FOTOFFICE SIN tocar la Caja operativa. Puro.
 *
 * DNX opera la Caja en FOTOFFICE desde el 19/10/2026: lo de Alboom es historia y no puede sumar en los saldos de las
 * cuentas, en los informes de Caja ni en los puntos del Club. Por eso NINGUNA parte crea `CashMovement`:
 * - lo cobrado de un pedido sale de sus cuotas `cleared` (`order_payments`): la parte de cuotas crea su
 *   `FotofficeCobro` sin movimiento; el cobro suelto (ar_paid) que coincide con una cuota se omite y el que no, va al
 *   libro histórico (nunca suma al pedido);
 * - pago o cuenta a pagar que no es un costo del pedido → `FotofficeCuentaPagar` (pagada sin movimiento);
 * - cuenta a cobrar con pedido → ya es una cuota del plan (se omite);
 * - lo demás (cobros y cuentas a cobrar sin pedido, todos los movimientos de bancos) → `FotofficeAlboomFinanza`,
 *   el libro "Histórico Alboom", de sólo lectura y fuera de la Caja.
 *
 * Forma real (crudos de DNX, 25/10/2026): `{ id, account_id, add_date, due_date, amount (texto; SIN signo en
 * ar/ap/ar_paid/ap_paid, CON signo en movimientos de bancos), category_id, category_name, class_id, cleared "0"/"1",
 * customer_id, document_number, document_type_id, document_type_name, internal_account_id, memo, order_id,
 * order_status_id }`. No trae `order_payment_id`.
 */

export const TIPO_COBRO = "COBRO";
export const TIPO_FINANZA = "FINANZA_HISTORICA";

/** Bancos: `account_id` "1.1.<id del banco>". */
const BANCO = /^1\.1\.(\w+)$/;

export const KINDS_FINANZA = ["INGRESO", "EGRESO", "TRANSFERENCIA", "A_COBRAR", "A_PAGAR"] as const;


function medio(p: Record<string, unknown>, metodoDe: Map<string, string>) {
  const idMetodo = idAlboom(p.document_type_id);
  return medioDePago(texto(p.document_type_name) ?? (idMetodo ? metodoDe.get(idMetodo) : null));
}

/** Fila del libro "Histórico Alboom". */
function finanza(c: Crudo, source: string, kind: string, ctx: { contactoDe: Map<string, string>; pedidoDe?: Map<string, string>; bancoDe: Map<string, string>; metodoDe: Map<string, string> }): Decision {
  const p = campos(c.payload);
  const monto = importeConSigno(p.amount ?? p.total);
  if (!monto || Number(monto.valor) === 0) return { accion: "OMITIR", motivo: MOTIVOS_8B2.importeCero };
  const dia = fecha(p.add_date) ?? fecha(p.due_date) ?? fecha(p.created);
  if (!dia) return { accion: "OMITIR", motivo: MOTIVOS_8B2.sinFecha };
  const cuenta = texto(p.account_id, 40);
  const banco = cuenta ? BANCO.exec(cuenta)?.[1] : undefined;
  const idCliente = idAlboom(p.customer_id);
  const idPedido = idAlboom(p.order_id);
  const idMetodo = idAlboom(p.document_type_id);
  const datos: Campos = {
    source,
    kind,
    amountArs: monto.valor,
    occurredOn: dia,
    dueOn: fecha(p.due_date),
    accountName: banco ? (ctx.bancoDe.get(banco) ?? `Banco ${banco} de Alboom`) : null,
    accountCode: cuenta,
    methodName: texto(p.document_type_name, 120) ?? (idMetodo ? (ctx.metodoDe.get(idMetodo) ?? null) : null),
    documentNumber: texto(p.document_number, 120),
    alboomCategory: texto(p.category_id, 20),
    // En una transferencia `customer_id` es el banco destino (doc 04 §12.2): no es un contacto.
    clientId: kind !== "TRANSFERENCIA" && idCliente ? (ctx.contactoDe.get(idCliente) ?? null) : null,
    pedidoId: idPedido ? (ctx.pedidoDe?.get(idPedido) ?? null) : null,
    alboomOrderId: idPedido,
    memo: textoLargo(p.memo, 2000),
    cleared: siNo(p.cleared) === true,
  };
  return { accion: "CREAR", datos, huellas: {} };
}

// ── Cobros (ar_paid) ────────────────────────────────────────────────────────────

export type CtxCobros = {
  pedidoDe: Map<string, string>;
  contactoDe: Map<string, string>;
  metodoDe: Map<string, string>;
  bancoDe: Map<string, string>;
  /** Cobro de Alboom → cuota cobrada con la que se emparejó (`emparejarCobros`). */
  emparejados: Map<string, string>;
  existentes: Set<string>;
  mapa: Map<string, EntradaMapa>;
};

/**
 * Cobro recibido de Alboom (`paginate_apr` ar_paid, importe sin signo). Lo cobrado de cada pedido sale SÓLO de sus
 * cuotas `cleared` (parte `cuotas`): si el cobro coincide con una (mismo pedido, importe y fecha cercana) se omite;
 * si no, va al libro Histórico Alboom (con el pedido anotado si se cargó, pero sin sumarle nada). Así un pedido nunca
 * queda cobrado dos veces ni por encima de lo que dicen sus cuotas.
 */
export function traducirCobro(c: Crudo, ctx: CtxCobros): Decision {
  if (ctx.emparejados.has(c.alboomId)) return { accion: "OMITIR", motivo: MOTIVOS_8B2.cuotaCobrada };
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const d = finanza(c, "COBRO", "INGRESO", ctx);
  const idPedido = idAlboom(campos(c.payload).order_id);
  if (d.accion === "CREAR" && idPedido && ctx.pedidoDe.has(idPedido)) return { ...d, dudas: [DUDAS_8B2.cobroSinCuota] };
  return d;
}

// ── Cuentas a cobrar pendientes (ar) ────────────────────────────────────────────

export type CtxFinanzas = {
  pedidoDe: Map<string, string>;
  contactoDe: Map<string, string>;
  bancoDe: Map<string, string>;
  metodoDe: Map<string, string>;
  existentes: Set<string>;
  mapa: Map<string, EntradaMapa>;
};

export function traducirCuentaCobrar(c: Crudo, ctx: CtxFinanzas): Decision {
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const idPedido = idAlboom(campos(c.payload).order_id);
  if (idPedido && ctx.pedidoDe.has(idPedido)) return { accion: "OMITIR", motivo: MOTIVOS_8B2.cuotaDelPedido };
  return finanza(c, "A_COBRAR", "A_COBRAR", ctx);
}

/** Movimiento de banco (`/account_trans/paginate`): 74 transferencia; con signo negativo, entrada (doc 04 §2.3). */
export function traducirMovimientoBanco(c: Crudo, ctx: CtxFinanzas): Decision {
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const p = campos(c.payload);
  const monto = importeConSigno(p.amount ?? p.total);
  const kind = texto(p.category_id) === "74" ? "TRANSFERENCIA" : monto?.negativo ? "INGRESO" : "EGRESO";
  return finanza(c, "BANCO", kind, ctx);
}

// ── Cuentas a pagar (ap) y pagos (ap_paid) ──────────────────────────────────────

export type CtxPagar = {
  pedidoDe: Map<string, string>;
  contactoDe: Map<string, string>;
  metodoDe: Map<string, string>;
  /** Asientos que ya representa un costo de pedido (`consumidosPorCostos`). */
  consumidos: Set<string>;
  existentes: Set<string>;
  mapa: Map<string, EntradaMapa>;
};

function cuentaPagar(c: Crudo, ctx: CtxPagar, pagada: boolean): Decision {
  if (ctx.consumidos.has(c.alboomId)) return { accion: "OMITIR", motivo: MOTIVOS_8B2.cubiertoPorCosto };
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const p = campos(c.payload);
  const monto = importeConSigno(p.amount ?? p.total);
  if (!monto || Number(monto.valor) <= 0) return { accion: "OMITIR", motivo: MOTIVOS_8B2.importeCero };
  const idPedido = idAlboom(p.order_id) ?? padreDe(c.alboomId);
  const idProveedor = idAlboom(p.customer_id);
  const dudas: string[] = [];
  let paidAt: string | null = null;
  let paidMethod: string | null = null;
  if (pagada) {
    paidAt = instanteAr(p.add_date) ?? instanteAr(p.cleared_date) ?? instanteAr(p.due_date);
    if (!paidAt) return { accion: "OMITIR", motivo: MOTIVOS_8B2.sinFecha };
    const m = medio(p, ctx.metodoDe);
    if (!m.conocido) dudas.push(DUDAS_8B2.medioDesconocido);
    paidMethod = m.medio;
  }
  return {
    accion: "CREAR",
    datos: {
      pedidoId: idPedido ? (ctx.pedidoDe.get(idPedido) ?? null) : null,
      supplierClientId: idProveedor ? (ctx.contactoDe.get(idProveedor) ?? null) : null,
      concept: (texto(p.memo, 200) ?? (pagada ? "Pago (Alboom)" : "Cuenta a pagar (Alboom)")).slice(0, 200),
      amountArs: monto.valor,
      dueDate: fecha(p.due_date),
      costCategoryId: null,
      paidAt,
      paidMethod,
    },
    huellas: {},
    ...(dudas.length ? { dudas } : {}),
  };
}

export const traducirCuentaPagarSuelta = (c: Crudo, ctx: CtxPagar) => cuentaPagar(c, ctx, false);
export const traducirPagoSuelto = (c: Crudo, ctx: CtxPagar) => cuentaPagar(c, ctx, true);
