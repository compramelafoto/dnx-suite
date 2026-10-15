import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { resolveDepositTarget } from "@/lib/cash/auto-deposit";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { recordCashMovement } from "@/lib/cash/record-movement";
import { buildReversal } from "@/lib/cash/reverse";
import { notificarEvento } from "@/lib/circuitos/eventos";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { asignarNumero } from "@/lib/numeracion/asignar";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { MENSAJES_PEDIDO, puedeGestionarPedidos, type CtxPedidos } from "./acceso";
import {
  ENTIDAD_NUMERACION_RECIBO, esEstadoPedido, esMedioCobro, MODULO_CAJA_PEDIDOS, SECUENCIA_RECIBO, type MedioCobro,
} from "./constantes";
import { hashDeToken, resolverClaveDeEnlace, tokenDelRecibo } from "./enlace";
import { imputadoPorCuota } from "./estado";
import { imputarConPreferida, validarImputacionManual, type CuotaConSaldo, type Imputacion } from "./imputacion";
import { bloquearPedido, pesosDeBase, pesosParaBase, planesDe } from "./plan";
import { aCentavos, desdeCentavos, esFechaValida, tieneHastaDosDecimales } from "./plan-cuotas";

/**
 * Cobros de un pedido (etapa 3, Entrega A, spec §2 A.4, §5): registrar y anular.
 *
 * **Registrar** va en UNA transacción, con el candado del pedido (`bloquearPedido`, el mismo de
 * editar el plan y cambiar el estado), así dos cobros a la vez no imputan el mismo saldo:
 *   1. valida el pedido (del workspace, no cancelado) y el importe (mayor que 0, no más que el saldo);
 *   2. imputa a las cuotas, automático (de la más vieja a la más nueva) o a mano, contra los saldos
 *      vigentes (las imputaciones de cobros anulados no cuentan);
 *   3. numera el recibo (secuencia `RECIBO`, `entityType` "COBRO": idempotente por cobro);
 *   4. crea el token del recibo (sólo su hash);
 *   5. deposita en Caja con las funciones de `lib/cash`: INGRESO, `sourceModule` "pedidos",
 *      `sourceRef` = id del cobro, el contacto del pedido, el rubro de ingreso del pedido y la cuenta
 *      del depósito automático según el medio (`resolveDepositTarget`);
 *   6. si es el primer cobro vigente: el pedido pasa de CONFIRMADO a EN_CURSO.
 * Afuera de la transacción, y sin poder deshacer el cobro (`notificarEvento` nunca lanza), el primer
 * cobro vigente avisa `SENA_COBRADA` al motor de etapas con la consulta del pedido, si tiene.
 *
 * **Todo cobro entra en Caja.** Con Caja apagada o sin una cuenta donde depositar, el cobro se
 * rechaza con un mensaje claro (a diferencia de Ventas, que vende igual): un cobro registrado sin
 * su movimiento deja el libro mintiendo.
 *
 * **Doble clic:** la clave de idempotencia del formulario es única por workspace; la misma clave
 * devuelve el cobro que ya estaba (`creado: false`) sin depositar otra vez.
 *
 * **Anular** exige motivo: contramovimiento en Caja con `buildReversal` (el de la anulación de
 * Caja), `voidedAt`, `voidReason` y `voidCashMovementId`. Las imputaciones dejan de contar (los
 * saldos se calculan sin los cobros anulados) y el recibo queda visible como ANULADO. Una segunda
 * anulación no hace nada.
 *
 * Nunca loguea datos personales: sólo códigos.
 */

type Tx = Prisma.TransactionClient;

/** Tope del importe de un cobro: lo que entra en `DECIMAL(12,2)` y en el importe en letras. */
export const MAX_IMPORTE_COBRO = 999_999_999.99;
export const MAX_MOTIVO_ANULACION = 1000;
export const MAX_IMPUTACIONES = 60;
const CLAVE_IDEMPOTENCIA = /^[A-Za-z0-9_-]{8,100}$/;

export const MENSAJES_COBRO = {
  noExiste: "No encontramos ese cobro.",
  cancelado: "El pedido está cancelado: no admite cobros.",
  importe: "El importe tiene que ser mayor que cero, con hasta dos decimales.",
  importeTope: "El importe es demasiado grande.",
  /** El mismo texto que el de la imputación (`lib/pedidos/imputacion.ts`). */
  saldoExcedido: "El importe supera el saldo del pedido.",
  fecha: "La fecha del cobro no es válida.",
  fechaFutura: "La fecha del cobro no puede ser posterior a hoy.",
  medio: "Elegí el medio de pago.",
  imputaciones: "El reparto entre cuotas no es válido.",
  adjunto: "No encontramos ese comprobante en la ficha del contacto del pedido (tiene que estar subido del todo).",
  clave: "Falta la clave del formulario. Volvé a abrirlo.",
  claveDeOtro: "Ese formulario ya se usó para otro pedido. Volvé a abrirlo.",
  sinCaja: "Para registrar cobros encendé el módulo Caja: cada cobro entra en Caja.",
  sinCuenta: "Para registrar el cobro hace falta una cuenta de Caja donde depositarlo (que no sea la caja fuerte). Creala en Caja → Cuentas y volvé a intentar.",
  sinClave: "Los recibos no están configurados. Avisale a quien administra FOTOFFICE.",
  motivo: "Escribí por qué se anula el cobro.",
  motivoLargo: `El motivo puede tener hasta ${MAX_MOTIVO_ANULACION} caracteres.`,
  sinCajaAnular: "Para anular cobros encendé el módulo Caja: el contramovimiento va a Caja.",
  fallo: "No se pudo registrar el cobro. Probá de nuevo.",
  falloAnular: "No se pudo anular el cobro. Probá de nuevo.",
} as const;

export type DatosCobro = {
  pedidoId: unknown;
  /** Pesos, con hasta dos decimales. */
  importe: unknown;
  /** Día del pago en Argentina, "aaaa-mm-dd". */
  fecha: unknown;
  medio: unknown;
  /** Reparto a mano: `[{ cuotaId, amountArs }]`. Sin esto, automático. */
  imputaciones?: unknown;
  /** Comprobante (`FotofficeAttachment` del workspace). */
  adjuntoId?: unknown;
  /** Clave única del formulario (8 a 100 caracteres: letras, números, `-` o `_`). */
  idempotencyKey: unknown;
};

export type ResultadoCobro =
  | {
      ok: true;
      cobroId: string;
      pedidoId: string;
      reciboNumero: string;
      /** false cuando la clave de idempotencia ya tenía un cobro (doble clic): no se depositó otra vez. */
      creado: boolean;
      /** Es el primer cobro vigente del pedido (se avisó `SENA_COBRADA`). */
      primero: boolean;
      /** El importe guardado del cobro (en un reintento, el del cobro que ya estaba). */
      importe: number;
    }
  | { ok: false; error: string };

export type ResultadoAnulacion = { ok: true; yaAnulado: boolean; pedidoId: string } | { ok: false; error: string };

export type DepsCobros = {
  ahora?: () => Date;
  /** Clave de los enlaces (para el token del recibo); por omisión, la del entorno. */
  clave?: string | null;
};

/** Corte con un mensaje para la persona (también lo usan las cuentas a pagar, `./cuentas-pagar.ts`). */
export class Corte extends Error {
  constructor(readonly mensaje: string) {
    super("corte");
  }
}

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function codigoDe(e: unknown): string | null {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : null;
}

function falla(donde: string, error: unknown): void {
  console.error(`[pedidos] ${donde} falló`, { codigo: codigoDe(error) });
}

/**
 * Instante del pago: el día elegido (hora de Argentina). Si es hoy, ahora; si es un día anterior,
 * ese día a las 12 de Argentina (así cae en ese día en cualquier reporte de Caja).
 */
export function instanteDelPago(fecha: string, ahora: Date): Date {
  if (fecha === diaEnBuenosAires(ahora)) return ahora;
  return new Date(`${fecha}T12:00:00.000-03:00`);
}

type Validado = {
  pedidoId: string;
  importe: number;
  fecha: string;
  medio: MedioCobro;
  manual: Imputacion[] | null;
  adjuntoId: string | null;
  clave: string;
};

function validar(datos: DatosCobro, ahora: Date): { ok: true; v: Validado } | { ok: false; error: string } {
  if (!datos || typeof datos !== "object") return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  if (!idValido(datos.pedidoId)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  if (typeof datos.idempotencyKey !== "string" || !CLAVE_IDEMPOTENCIA.test(datos.idempotencyKey)) {
    return { ok: false, error: MENSAJES_COBRO.clave };
  }
  const importe = datos.importe;
  if (typeof importe !== "number" || !tieneHastaDosDecimales(importe) || aCentavos(importe) <= 0) {
    return { ok: false, error: MENSAJES_COBRO.importe };
  }
  if (importe > MAX_IMPORTE_COBRO) return { ok: false, error: MENSAJES_COBRO.importeTope };
  if (!esFechaValida(datos.fecha)) return { ok: false, error: MENSAJES_COBRO.fecha };
  if (datos.fecha > diaEnBuenosAires(ahora)) return { ok: false, error: MENSAJES_COBRO.fechaFutura };
  if (!esMedioCobro(datos.medio)) return { ok: false, error: MENSAJES_COBRO.medio };
  let manual: Imputacion[] | null = null;
  if (datos.imputaciones !== undefined && datos.imputaciones !== null) {
    const raw = datos.imputaciones;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_IMPUTACIONES) return { ok: false, error: MENSAJES_COBRO.imputaciones };
    manual = [];
    for (const i of raw) {
      if (!i || typeof i !== "object") return { ok: false, error: MENSAJES_COBRO.imputaciones };
      const { cuotaId, amountArs } = i as Record<string, unknown>;
      if (!idValido(cuotaId) || typeof amountArs !== "number") return { ok: false, error: MENSAJES_COBRO.imputaciones };
      manual.push({ cuotaId, amountArs });
    }
  }
  let adjuntoId: string | null = null;
  if (datos.adjuntoId !== undefined && datos.adjuntoId !== null && datos.adjuntoId !== "") {
    if (!idValido(datos.adjuntoId)) return { ok: false, error: MENSAJES_COBRO.adjunto };
    adjuntoId = datos.adjuntoId;
  }
  return {
    ok: true,
    v: { pedidoId: datos.pedidoId, importe: desdeCentavos(aCentavos(importe)), fecha: datos.fecha, medio: datos.medio, manual, adjuntoId, clave: datos.idempotencyKey },
  };
}

/** El cobro de una clave de idempotencia, si ya existe. */
async function porClave(
  cliente: Pick<Tx, "fotofficeCobro">,
  workspaceId: string,
  clave: string,
): Promise<CobroPorClave | null> {
  return cliente.fotofficeCobro.findFirst({
    where: { workspaceId, idempotencyKey: clave },
    select: { id: true, pedidoId: true, receiptNumber: true, amountArs: true },
  });
}

type CobroPorClave = { id: string; pedidoId: string; receiptNumber: string; amountArs: { toString(): string } };

function repetido(c: CobroPorClave, pedidoId: string): ResultadoCobro {
  if (c.pedidoId !== pedidoId) return { ok: false, error: MENSAJES_COBRO.claveDeOtro };
  return { ok: true, cobroId: c.id, pedidoId: c.pedidoId, reciboNumero: c.receiptNumber, creado: false, primero: false, importe: pesosDeBase(c.amountArs) };
}

/** Saldos vigentes de cada cuota (importe menos lo imputado por cobros sin anular). */
async function cuotasConSaldo(tx: Tx, workspaceId: string, pedidoId: string): Promise<CuotaConSaldo[]> {
  const plan = (await planesDe(workspaceId, [pedidoId], tx)).get(pedidoId) ?? { cuotas: [], imputaciones: [] };
  const imputado = imputadoPorCuota(plan.imputaciones);
  return plan.cuotas.map((c) => ({
    id: c.id,
    position: c.position,
    dueDate: c.dueDate,
    saldo: desdeCentavos(Math.max(0, aCentavos(c.amountArs) - (imputado.get(c.id) ?? 0))),
  }));
}

/** Lo que el núcleo del cobro necesita; lo arman el cobro manual y el del sistema. */
type EntradaCobro = {
  workspaceId: string;
  pedidoId: string;
  importe: number;
  paidAt: Date;
  medio: MedioCobro;
  /** Reparto a mano; sin esto, automático. */
  manual: Imputacion[] | null;
  /** Cuota que se paga primero (el cobro del sistema); el resto, de la más vieja a la más nueva. */
  preferida: string | null;
  adjuntoId: string | null;
  /** Clave del formulario; null en un cobro del sistema (su idempotencia es el id del pago). */
  clave: string | null;
  claveEnlace: string;
  /** null = el sistema. */
  createdByUserId: number | null;
  /** Pago del proveedor (Mercado Pago): su id, la comisión y el neto, si se conocen. */
  proveedor: { paymentRef: string; feeArs: number | null; netArs: number | null } | null;
};

/**
 * El núcleo del cobro, dentro de la transacción y con el candado del pedido YA tomado: valida el
 * pedido, imputa, numera el recibo, deposita en Caja, crea el cobro y su reparto, y pasa el pedido
 * a EN_CURSO. Lo usan `registrarCobro` (a mano) y `registrarCobroDelSistema` (Mercado Pago).
 * Corta con `Corte` y un mensaje si no se puede.
 */
async function aplicarCobro(tx: Tx, e: EntradaCobro): Promise<{ cobroId: string; numero: string; primero: boolean; consultaLeadId: string | null }> {
  const { workspaceId, paidAt, claveEnlace } = e;
  const p = await tx.fotofficePedido.findFirst({
    where: { id: e.pedidoId, workspaceId },
    select: { id: true, number: true, status: true, clientId: true, consultaLeadId: true, incomeCategoryId: true, totalArs: true },
  });
  if (!p || !esEstadoPedido(p.status)) throw new Corte(MENSAJES_PEDIDO.noExiste);
  if (p.status === "CANCELADO") throw new Corte(MENSAJES_COBRO.cancelado);

  if (e.adjuntoId) {
    // El comprobante es un adjunto LISTO de la ficha del contacto del pedido (adonde lo sube el
    // diálogo): nunca de otro contacto, de un socio ni una subida sin confirmar.
    const a = await tx.fotofficeAttachment.findFirst({
      where: { id: e.adjuntoId, workspaceId, clientId: p.clientId, status: "LISTO", deletedAt: null },
      select: { id: true },
    });
    if (!a) throw new Corte(MENSAJES_COBRO.adjunto);
  }

  // Imputación contra los saldos vigentes, leídos con el candado tomado.
  const cuotas = await cuotasConSaldo(tx, workspaceId, p.id);
  const imp = e.manual ? validarImputacionManual(cuotas, e.manual, e.importe) : imputarConPreferida(cuotas, e.importe, e.preferida);
  if (!imp.ok) throw new Corte(imp.error);

  // Los cobros vigentes, con el candado tomado: ningún otro cobro de este pedido está a mitad de camino.
  const vigentes = await tx.fotofficeCobro.findMany({ where: { workspaceId, pedidoId: p.id, voidedAt: null }, select: { amountArs: true } });
  // Además del saldo de las cuotas, el del pedido: si el total bajó y el plan quedó descuadrado,
  // las cuotas podrían sumar más que lo que falta pagar. Nunca se cobra más que total − cobrado.
  const cobrado = vigentes.reduce((s, c) => s + decimalArsToMinor(c.amountArs), 0);
  if (aCentavos(e.importe) > decimalArsToMinor(p.totalArs) - cobrado) throw new Corte(MENSAJES_COBRO.saldoExcedido);
  const primero = vigentes.length === 0;

  // Dónde entra en Caja. Nunca inventa una cuenta: sin cuenta, no hay cobro.
  const cuentas = await tx.cashAccount.findMany({
    where: { workspaceId, isActive: true },
    select: { id: true, name: true, kind: true, isDefault: true, isVault: true },
    orderBy: { order: "asc" },
  });
  const destino = resolveDepositTarget({ cashEnabled: true, paymentMethod: e.medio, accounts: cuentas, categories: [], categoryName: "" });
  if (!destino.ok) throw new Corte(MENSAJES_COBRO.sinCuenta);
  // El rubro de ingreso del pedido, si sigue siendo un rubro INGRESO del workspace.
  const rubro = p.incomeCategoryId
    ? await tx.cashCategory.findFirst({ where: { id: p.incomeCategoryId, workspaceId, kind: "INGRESO" }, select: { id: true } })
    : null;

  const cobroId = randomUUID();
  const numero = await asignarNumero(tx, {
    workspaceId, key: SECUENCIA_RECIBO, entityType: ENTIDAD_NUMERACION_RECIBO, entityId: cobroId, fecha: paidAt,
  });
  const movimiento = await recordCashMovement(tx, {
    workspaceId,
    accountId: destino.accountId,
    kind: "INGRESO",
    amountMinor: aCentavos(e.importe),
    occurredAt: paidAt,
    description: `Cobro pedido N° ${p.number} · recibo ${numero.display}`,
    sourceModule: MODULO_CAJA_PEDIDOS,
    sourceRef: cobroId,
    categoryId: rubro?.id ?? null,
    clientId: p.clientId,
    paymentMethod: e.medio,
    createdByUserId: e.createdByUserId,
  });
  await tx.fotofficeCobro.create({
    data: {
      id: cobroId,
      workspaceId,
      pedidoId: p.id,
      clientId: p.clientId,
      paidAt,
      method: e.medio,
      amountArs: pesosParaBase(e.importe),
      feeArs: e.proveedor?.feeArs == null ? null : pesosParaBase(e.proveedor.feeArs),
      netArs: e.proveedor?.netArs == null ? null : pesosParaBase(e.proveedor.netArs),
      providerPaymentRef: e.proveedor?.paymentRef ?? null,
      cashMovementId: movimiento.id,
      attachmentId: e.adjuntoId,
      receiptNumber: numero.display,
      receiptTokenHash: hashDeToken(tokenDelRecibo(cobroId, claveEnlace)),
      idempotencyKey: e.clave,
      createdByUserId: e.createdByUserId,
    },
    select: { id: true },
  });
  await tx.fotofficeCobroImputacion.createMany({
    data: imp.imputaciones.map((i) => ({ workspaceId, cobroId, cuotaId: i.cuotaId, amountArs: pesosParaBase(i.amountArs) })),
  });
  if (primero && p.status === "CONFIRMADO") {
    await tx.fotofficePedido.updateMany({ where: { id: p.id, workspaceId, status: "CONFIRMADO" }, data: { status: "EN_CURSO" } });
  }
  return { cobroId, numero: numero.display, primero, consultaLeadId: p.consultaLeadId };
}

/** Registra un cobro del pedido. Ver el comentario del archivo. Con "Gestionar" en Pedidos. */
export async function registrarCobro(ctx: CtxPedidos, datos: DatosCobro, deps: DepsCobros = {}): Promise<ResultadoCobro> {
  if (!puedeGestionarPedidos(ctx)) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  const ahora = (deps.ahora ?? (() => new Date()))();
  const val = validar(datos, ahora);
  if (!val.ok) return val;
  const v = val.v;
  const { workspaceId } = ctx;

  // Doble clic: la misma clave devuelve el cobro que ya estaba, sin pedir nada más.
  const previo = await porClave(prisma, workspaceId, v.clave);
  if (previo) return repetido(previo, v.pedidoId);

  // Afuera de la transacción (lee con el cliente global): Caja encendida y la clave de los recibos.
  if (!(await isModuleEnabledForWorkspace(workspaceId, CASH_MODULE_KEY))) return { ok: false, error: MENSAJES_COBRO.sinCaja };
  const claveEnlace = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
  if (!claveEnlace) return { ok: false, error: MENSAJES_COBRO.sinClave };

  const paidAt = instanteDelPago(v.fecha, ahora);
  let hecho: { cobroId: string; numero: string; primero: boolean; consultaLeadId: string | null };
  try {
    hecho = await prisma.$transaction(async (tx) => {
      await bloquearPedido(tx, v.pedidoId);
      const yaEstaba = await porClave(tx, workspaceId, v.clave);
      if (yaEstaba) throw new Repetido(yaEstaba);

      return aplicarCobro(tx, {
        workspaceId, pedidoId: v.pedidoId, importe: v.importe, paidAt, medio: v.medio, manual: v.manual, preferida: null,
        adjuntoId: v.adjuntoId, clave: v.clave, claveEnlace, createdByUserId: ctx.userId, proveedor: null,
      });
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    if (e instanceof Repetido) return repetido(e.cobro, v.pedidoId);
    // Otra pestaña con la misma clave confirmó en el medio (el único de la clave frena): ese cobro.
    if (codigoDe(e) === "P2002") {
      const otro = await porClave(prisma, workspaceId, v.clave).catch(() => null);
      if (otro) return repetido(otro, v.pedidoId);
    }
    falla("registrarCobro", e);
    return { ok: false, error: MENSAJES_COBRO.fallo };
  }

  // Lo que sigue nunca deshace el cobro: `notificarEvento` no lanza.
  // Doble red: `notificarEvento` no lanza, y si alguna vez lo hiciera, el cobro ya está hecho.
  if (hecho.primero) await avisarSenaCobrada(workspaceId, v.pedidoId, hecho.consultaLeadId, hecho.cobroId);
  return { ok: true, cobroId: hecho.cobroId, pedidoId: v.pedidoId, reciboNumero: hecho.numero, creado: true, primero: hecho.primero, importe: v.importe };
}

/**
 * Primer cobro vigente de un pedido: avisa `SENA_COBRADA` a la consulta (si tiene) y a cada proyecto
 * del pedido (Etapa 4; el motor sólo mueve los recorridos abiertos que tengan una regla de ese
 * evento). Nunca lanza: el cobro ya está hecho.
 */
async function avisarSenaCobrada(workspaceId: string, pedidoId: string, consultaLeadId: string | null, cobroId: string): Promise<void> {
  if (consultaLeadId) {
    await notificarEvento(workspaceId, { tipo: "CAPTACION", id: consultaLeadId }, "SENA_COBRADA", cobroId).catch(() => undefined);
  }
  try {
    const proyectos = await prisma.fotofficeProyecto.findMany({ where: { workspaceId, pedidoId }, select: { id: true }, orderBy: { createdAt: "asc" } });
    for (const p of proyectos) {
      await notificarEvento(workspaceId, { tipo: "PROYECTO", id: p.id }, "SENA_COBRADA", cobroId).catch(() => undefined);
    }
  } catch (e) {
    falla("avisarSenaCobrada", e);
  }
}

export type DatosCobroDelSistema = {
  workspaceId: string;
  pedidoId: string;
  /** Pesos, con hasta dos decimales (el bruto del pago). */
  importe: number;
  /** Cuándo se aprobó el pago; null = ahora. */
  paidAt: Date | null;
  /** La cuota que la persona eligió pagar: se imputa primero. */
  cuotaPreferidaId: string | null;
  /** Id del pago en Mercado Pago: el cobro se identifica por él (único en la base). */
  providerPaymentRef: string;
  feeArs: number | null;
  netArs: number | null;
};

/** Por qué un pago aprobado no se pudo acreditar: sirve para avisar al responsable. */
export type MotivoSinAcreditar = "CANCELADO" | "EXCEDE" | "SIN_CAJA" | "SIN_CUENTA" | "SIN_CLAVE" | "NO_EXISTE" | "DATOS" | "FALLO";

export type ResultadoCobroDelSistema =
  | { ok: true; cobroId: string; pedidoId: string; reciboNumero: string; creado: boolean; primero: boolean }
  | { ok: false; motivo: MotivoSinAcreditar; error: string };

function motivoDe(mensaje: string): MotivoSinAcreditar {
  if (mensaje === MENSAJES_COBRO.cancelado) return "CANCELADO";
  if (mensaje === MENSAJES_COBRO.saldoExcedido) return "EXCEDE";
  if (mensaje === MENSAJES_COBRO.sinCuenta) return "SIN_CUENTA";
  if (mensaje === MENSAJES_PEDIDO.noExiste) return "NO_EXISTE";
  return "FALLO";
}

/**
 * El cobro de un pago aprobado de Mercado Pago (Entrega B2): el mismo núcleo que el cobro manual
 * (candado, imputación, número de recibo, Caja, `SENA_COBRADA`, EN_CURSO), sin persona que lo
 * registre (`createdByUserId` nulo = "Sistema"), con medio MERCADO_PAGO y la cuota elegida primero.
 *
 * **Idempotente por `providerPaymentRef`**: si ya hay un cobro con ese pago, no hace nada
 * (`creado: false`); la carrera la frena el único de la base (P2002 = ya acreditado).
 * **Nunca crea saldo negativo**: un pago que supera el saldo, de un pedido cancelado o sin dónde
 * depositar NO se acredita y devuelve el motivo, para que el llamador avise a una persona.
 *
 * El llamador (webhook / vuelta del comprador) ya validó que el pago es de este pedido y de esta
 * organización. No lanza. Sólo códigos en los logs.
 */
export async function registrarCobroDelSistema(datos: DatosCobroDelSistema, deps: DepsCobros = {}): Promise<ResultadoCobroDelSistema> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const { workspaceId, pedidoId, providerPaymentRef } = datos;
  if (!idValido(workspaceId) || !idValido(pedidoId) || typeof providerPaymentRef !== "string" || providerPaymentRef.length === 0 || providerPaymentRef.length > 100) {
    return { ok: false, motivo: "DATOS", error: MENSAJES_PEDIDO.datosInvalidos };
  }
  const importe = datos.importe;
  if (typeof importe !== "number" || !tieneHastaDosDecimales(importe) || aCentavos(importe) <= 0 || importe > MAX_IMPORTE_COBRO) {
    return { ok: false, motivo: "DATOS", error: MENSAJES_COBRO.importe };
  }
  const centavosOk = (n: number | null) => n === null || (Number.isFinite(n) && tieneHastaDosDecimales(n));
  const feeArs = centavosOk(datos.feeArs) ? datos.feeArs : null;
  const netArs = centavosOk(datos.netArs) ? datos.netArs : null;

  const previo = await porPago(prisma, providerPaymentRef);
  if (previo) return repetidoDelSistema(previo);

  if (!(await isModuleEnabledForWorkspace(workspaceId, CASH_MODULE_KEY))) return { ok: false, motivo: "SIN_CAJA", error: MENSAJES_COBRO.sinCaja };
  const claveEnlace = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
  if (!claveEnlace) return { ok: false, motivo: "SIN_CLAVE", error: MENSAJES_COBRO.sinClave };

  const paidAt = datos.paidAt && datos.paidAt.getTime() <= ahora.getTime() ? datos.paidAt : ahora;
  let hecho: { cobroId: string; numero: string; primero: boolean; consultaLeadId: string | null };
  try {
    hecho = await prisma.$transaction(async (tx) => {
      await bloquearPedido(tx, pedidoId);
      const yaEstaba = await porPago(tx, providerPaymentRef);
      if (yaEstaba) throw new RepetidoDelSistema(yaEstaba);
      return aplicarCobro(tx, {
        workspaceId, pedidoId, importe: desdeCentavos(aCentavos(importe)), paidAt, medio: "MERCADO_PAGO", manual: null,
        preferida: datos.cuotaPreferidaId, adjuntoId: null, clave: null, claveEnlace, createdByUserId: null,
        proveedor: { paymentRef: providerPaymentRef, feeArs, netArs },
      });
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return { ok: false, motivo: motivoDe(e.mensaje), error: e.mensaje };
    if (e instanceof RepetidoDelSistema) return repetidoDelSistema(e.cobro);
    // Otro aviso del mismo pago confirmó en el medio (el único de `providerPaymentRef` frena): ya acreditado.
    if (codigoDe(e) === "P2002") {
      const otro = await porPago(prisma, providerPaymentRef).catch(() => null);
      if (otro) return repetidoDelSistema(otro);
    }
    falla("registrarCobroDelSistema", e);
    return { ok: false, motivo: "FALLO", error: MENSAJES_COBRO.fallo };
  }

  if (hecho.primero) await avisarSenaCobrada(workspaceId, pedidoId, hecho.consultaLeadId, hecho.cobroId);
  return { ok: true, cobroId: hecho.cobroId, pedidoId, reciboNumero: hecho.numero, creado: true, primero: hecho.primero };
}

type CobroPorPago = { id: string; pedidoId: string; receiptNumber: string };

async function porPago(cliente: Pick<Tx, "fotofficeCobro">, providerPaymentRef: string): Promise<CobroPorPago | null> {
  return cliente.fotofficeCobro.findFirst({ where: { providerPaymentRef }, select: { id: true, pedidoId: true, receiptNumber: true } });
}

function repetidoDelSistema(c: CobroPorPago): ResultadoCobroDelSistema {
  return { ok: true, cobroId: c.id, pedidoId: c.pedidoId, reciboNumero: c.receiptNumber, creado: false, primero: false };
}

class RepetidoDelSistema extends Error {
  constructor(readonly cobro: CobroPorPago) {
    super("repetido");
  }
}

class Repetido extends Error {
  constructor(readonly cobro: CobroPorClave) {
    super("repetido");
  }
}

/**
 * Anula un cobro con su motivo. Ver el comentario del archivo. Con "Gestionar" en Pedidos.
 *
 * Si alguien ya anuló a mano el movimiento desde Caja (`/caja/movimientos`), el dinero ya volvió:
 * no se escribe un segundo contramovimiento, se usa ése (mismo criterio que anular una venta).
 */
export async function anularCobro(ctx: CtxPedidos, cobroId: unknown, motivo: unknown, deps: DepsCobros = {}): Promise<ResultadoAnulacion> {
  if (!puedeGestionarPedidos(ctx)) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  if (!idValido(cobroId)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  if (typeof motivo !== "string" || motivo.trim() === "") return { ok: false, error: MENSAJES_COBRO.motivo };
  const razon = motivo.trim();
  if (razon.length > MAX_MOTIVO_ANULACION) return { ok: false, error: MENSAJES_COBRO.motivoLargo };
  const { workspaceId } = ctx;
  const ahora = (deps.ahora ?? (() => new Date()))();

  const c0 = await prisma.fotofficeCobro.findFirst({ where: { id: cobroId, workspaceId }, select: { id: true, pedidoId: true, voidedAt: true } });
  if (!c0) return { ok: false, error: MENSAJES_COBRO.noExiste };
  if (c0.voidedAt) return { ok: true, yaAnulado: true, pedidoId: c0.pedidoId };
  if (!(await isModuleEnabledForWorkspace(workspaceId, CASH_MODULE_KEY))) return { ok: false, error: MENSAJES_COBRO.sinCajaAnular };

  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoAnulacion> => {
      await bloquearPedido(tx, c0.pedidoId);
      const c = await tx.fotofficeCobro.findFirst({
        where: { id: c0.id, workspaceId },
        select: { id: true, voidedAt: true, cashMovementId: true },
      });
      if (!c) throw new Corte(MENSAJES_COBRO.noExiste);
      // La segunda anulación (otra pestaña que ganó la carrera) no hace nada.
      if (c.voidedAt) return { ok: true, yaAnulado: true, pedidoId: c0.pedidoId };

      let voidCashMovementId: string | null = null;
      if (c.cashMovementId) voidCashMovementId = await contramovimiento(tx, workspaceId, c.cashMovementId, razon, ahora, ctx.userId);

      const r = await tx.fotofficeCobro.updateMany({
        where: { id: c.id, workspaceId, voidedAt: null },
        data: { voidedAt: ahora, voidReason: razon, voidCashMovementId },
      });
      if (r.count !== 1) return { ok: true, yaAnulado: true, pedidoId: c0.pedidoId };
      return { ok: true, yaAnulado: false, pedidoId: c0.pedidoId };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    falla("anularCobro", e);
    return { ok: false, error: MENSAJES_COBRO.falloAnular };
  }
}

/**
 * Escribe el contramovimiento del depósito con `buildReversal` y devuelve su id. Si ya estaba
 * anulado a mano, devuelve el de esa anulación. Si `buildReversal` rechaza por otro motivo (una
 * pata de un pase entre cuentas: un cobro nunca lo es), corta con ese mensaje. También anula el
 * pago de una cuenta a pagar (`./cuentas-pagar.ts`).
 */
export async function contramovimiento(
  tx: Tx,
  workspaceId: string,
  movimientoId: string,
  motivo: string,
  ahora: Date,
  userId: number | null,
): Promise<string | null> {
  const m = await tx.cashMovement.findFirst({
    where: { id: movimientoId, workspaceId },
    select: { id: true, kind: true, amountArs: true, accountId: true, categoryId: true, paymentMethod: true, clientId: true, description: true, transferId: true },
  });
  // La referencia está rota (no debería pasar: el movimiento lo escribió el cobro): nada que revertir.
  if (!m) return null;
  const yaAnulado = await tx.cashMovement.findFirst({ where: { workspaceId, reversesMovementId: m.id }, select: { id: true } });
  if (yaAnulado) return yaAnulado.id;
  const r = buildReversal(
    {
      id: m.id,
      kind: m.kind as "INGRESO" | "EGRESO",
      amountMinor: decimalArsToMinor(m.amountArs),
      accountId: m.accountId,
      categoryId: m.categoryId,
      paymentMethod: m.paymentMethod,
      clientId: m.clientId,
      description: m.description,
      alreadyReversed: false,
      transferId: m.transferId,
    },
    motivo,
  );
  if (!r.ok) throw new Corte(r.error);
  const v = r.values;
  // Si la anulación pasa con el turno abierto, entra en su arqueo (mismo criterio que Caja y Ventas).
  const turno = await tx.cashShift.findFirst({ where: { workspaceId, accountId: v.accountId, status: "ABIERTO" }, select: { id: true } });
  const creado = await tx.cashMovement.create({
    data: {
      workspaceId,
      accountId: v.accountId,
      shiftId: turno?.id ?? null,
      kind: v.kind,
      amountArs: minorToDecimalString(v.amountMinor),
      occurredAt: ahora,
      categoryId: v.categoryId,
      paymentMethod: v.paymentMethod,
      clientId: v.clientId,
      description: v.description,
      sourceModule: v.sourceModule,
      sourceRef: v.sourceRef,
      reversesMovementId: v.reversesMovementId,
      reverseReason: v.reverseReason,
      transferId: v.transferId,
      createdByUserId: userId,
    },
    select: { id: true },
  });
  return creado.id;
}
