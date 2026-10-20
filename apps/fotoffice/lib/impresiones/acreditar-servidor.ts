import "server-only";
import { after } from "next/server";
import { prisma, type Prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { resolveDepositTarget } from "@/lib/cash/auto-deposit";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { recordCashMovement } from "@/lib/cash/record-movement";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { findOrCreateClient } from "@/lib/clients/find-or-create";
import type { PagoMp } from "@/lib/galerias/acreditar";
import { hechosDelPago, pagoAprobado, paymentIdValido } from "@/lib/galerias/venta-publica";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { crearProyectoDeSistema } from "@/lib/proyectos/crear";
import { avisarPedidoConfirmado } from "./avisos-servidor";
import { agruparPorLaboratorio } from "./carpeta-lab";
import { CIRCUITO_POR_OMISION, DIAS_HABILES_PROMETIDOS } from "./constantes";
import { sumarDiasHabiles } from "./dias-habiles";
import { pedidoDeReferencia, referenciaPedido } from "./pago-servidor";

/**
 * Acreditar el pago de un pedido de copias impresas: lo comparten el aviso de Mercado Pago y la vuelta del
 * comprador. Un pago `approved`, en pesos, leído con el token del estudio, cuya referencia
 * (`fo-impresion:<id>`) nombra un pedido de ESE estudio, por un importe mayor o igual al total.
 *
 * En una sola transacción:
 *   1. la escritura condicional `PENDIENTE_PAGO | CANCELADO → PAGADO` sin pago previo (de dos avisos a la vez
 *      gana uno; el otro no encuentra nada que cambiar y devuelve `yaEstaba: true` sin repetir nada);
 *   2. un trabajo por laboratorio (`crearProyectoDeSistema`) en el circuito de Impresiones, con la entrega
 *      prometida (48 horas hábiles) y lo que cobra el laboratorio. Sin circuito de trabajo el pedido queda
 *      PAGADO igual —el cliente ya pagó— con `lastError` para que lo muestre la preparación;
 *   3. con Caja encendida y una cuenta donde depositar, el INGRESO (`sourceModule` "impresiones").
 * Después, el correo de confirmación al cliente (fuera de la respuesta, con `after()`).
 *
 * Nunca loguea datos personales: sólo códigos.
 */

type Tx = Prisma.TransactionClient;

export type ResultadoAcreditarImpresion =
  | { ok: true; yaEstaba: boolean }
  | { ok: false; error: "NO_ES_IMPRESION" | "NO_APROBADO" | "MONEDA" | "IMPORTE_MENOR" | "NO_EXISTE" };

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const idValido = (v: unknown): v is string => typeof v === "string" && ID_VALIDO.test(v);
const cents = (v: { toString(): string } | string) => Math.round(Number(String(v)) * 100);
const pesos = (c: number) => (c / 100).toFixed(2);
/** Un día `AAAA-MM-DD` para una columna `@db.Date`: el mediodía UTC cae en ese día en cualquier zona. */
const dia = (ymd: string) => new Date(`${ymd}T12:00:00Z`);

export const SIN_CIRCUITO = "No hay circuito de trabajo";

function programar(tarea: () => Promise<unknown>): void {
  const segura = () => tarea().catch(() => undefined);
  try {
    after(segura);
  } catch {
    void segura();
  }
}

/**
 * El circuito de los trabajos: el de la configuración de Impresiones; si no, el de nombre por omisión; si no,
 * el de trabajo por omisión; si no, cualquier circuito de trabajo activo. Siempre con alguna etapa viva (un
 * circuito sin etapas no puede abrir el recorrido).
 */
async function circuitoDeTrabajo(tx: Tx, workspaceId: string, elegido: string | null): Promise<string | null> {
  const base = { workspaceId, kind: "TRABAJO", isActive: true, stages: { some: { archivedAt: null } } };
  const intentos: Prisma.FotofficeCircuitWhereInput[] = [
    ...(elegido ? [{ ...base, id: elegido }] : []),
    { ...base, name: CIRCUITO_POR_OMISION },
    { ...base, isDefault: true },
    base,
  ];
  for (const where of intentos) {
    const c = await tx.fotofficeCircuit.findFirst({ where, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (c) return c.id;
  }
  return null;
}

function partirNombre(nombre: string): { firstName: string | null; lastName: string | null } {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { firstName: null, lastName: null };
  return { firstName: partes[0], lastName: partes.length > 1 ? partes.slice(1).join(" ") : null };
}

type ItemSinTrabajo = { id: string; proveedorId: string | null; quantity: number; unitCostArs: { toString(): string } | string };

/**
 * Un trabajo por laboratorio para las copias que todavía no tienen uno, en el circuito de Impresiones (con el
 * mismo orden de búsqueda que la acreditación), con la entrega prometida y lo que cobra el laboratorio.
 * Devuelve false si no hay ningún circuito de trabajo (no crea nada).
 */
async function crearTrabajosEnTransaccion(
  tx: Tx,
  workspaceId: string,
  d: { id: string; number: number; clientId: string; hoy: string; prometido: Date | null; items: ItemSinTrabajo[] },
): Promise<boolean> {
  const ajustes = await tx.fotofficePrintSettings.findUnique({ where: { workspaceId }, select: { circuitId: true } });
  const circuitId = await circuitoDeTrabajo(tx, workspaceId, ajustes?.circuitId ?? null);
  if (!circuitId) return false;
  for (const [proveedorId, items] of agruparPorLaboratorio(d.items)) {
    const costo = items.reduce((s, i) => s + cents(i.unitCostArs) * i.quantity, 0);
    const proyecto = await crearProyectoDeSistema(tx, workspaceId, {
      clientId: d.clientId,
      circuitId,
      nombre: `Copias impresas · pedido ${d.number}`,
      baseDate: d.hoy,
      proveedorId,
      ahora: new Date(),
    });
    await tx.fotofficeProyecto.update({ where: { id: proyecto.id }, data: { entregaPrometida: d.prometido, proveedorCostoArs: pesos(costo) } });
    await tx.fotofficePrintOrderItem.updateMany({ where: { orderId: d.id, id: { in: items.map((i) => i.id) } }, data: { proyectoId: proyecto.id } });
  }
  return true;
}

export type ResultadoAsegurarTrabajos = "OK" | "SIN_CIRCUITO" | "SIN_CLIENTE" | "NO_EXISTE";

/**
 * Para la preparación (y su «Reintentar»): si el pedido pagado quedó sin trabajos —no había circuito cuando
 * se acreditó—, los crea ahora con el mismo criterio. Quien llama tiene tomado el pedido (PREPARANDO), así
 * que no corre en paralelo con otra preparación.
 */
export async function asegurarTrabajosDelPedido(workspaceId: string, pedidoId: string, ahora: Date): Promise<ResultadoAsegurarTrabajos> {
  return prisma.$transaction(async (tx) => {
    const p = await tx.fotofficePrintOrder.findUnique({ where: { id: pedidoId }, include: { items: true } });
    if (!p || p.workspaceId !== workspaceId) return "NO_EXISTE" as const;
    const sinTrabajo = p.items.filter((i) => !i.proyectoId);
    if (sinTrabajo.length === 0) return "OK" as const;
    if (!p.clientId) return "SIN_CLIENTE" as const;
    const ok = await crearTrabajosEnTransaccion(tx, workspaceId, {
      id: p.id, number: p.number, clientId: p.clientId, hoy: diaEnBuenosAires(ahora), prometido: p.promisedAt, items: sinTrabajo,
    });
    return ok ? ("OK" as const) : ("SIN_CIRCUITO" as const);
  }, OPCIONES_TRANSACCION);
}

export async function acreditarPagoImpresion(workspaceId: string, pago: PagoMp): Promise<ResultadoAcreditarImpresion> {
  const id = pedidoDeReferencia(pago.externalReference);
  if (!idValido(id)) return { ok: false, error: "NO_ES_IMPRESION" };
  if (!pagoAprobado(pago)) return { ok: false, error: "NO_APROBADO" };
  if (pago.currency !== "ARS") return { ok: false, error: "MONEDA" };
  const pedido = await prisma.fotofficePrintOrder.findUnique({ where: { id }, include: { items: true } });
  if (!pedido || pedido.workspaceId !== workspaceId) return { ok: false, error: "NO_EXISTE" };
  const totalCents = cents(pedido.totalArs);
  if (pago.amountMinor < totalCents) return { ok: false, error: "IMPORTE_MENOR" };

  const hechos = hechosDelPago(pago);
  const paidAt = hechos.paidAt ?? new Date();
  const hoy = diaEnBuenosAires(paidAt);
  const prometido = dia(sumarDiasHabiles(hoy, DIAS_HABILES_PROMETIDOS));
  // Se lee afuera de la transacción, como en galerías.
  const cajaEncendida = await isModuleEnabledForWorkspace(workspaceId, CASH_MODULE_KEY);

  const resultado = await prisma.$transaction(async (tx) => {
    const cambio = await tx.fotofficePrintOrder.updateMany({
      where: { id, workspaceId, status: { in: ["PENDIENTE_PAGO", "CANCELADO"] }, providerPaymentRef: null },
      data: {
        status: "PAGADO",
        paidAt,
        providerPaymentRef: hechos.providerPaymentId,
        promisedAt: prometido,
        feeArs: hechos.feeMinor === null ? null : pesos(hechos.feeMinor),
        netArs: hechos.feeMinor === null ? null : pesos(hechos.amountMinor - hechos.feeMinor),
      },
    });
    if (cambio.count === 0) {
      // Otro pago aprobado para un pedido que ya tiene el suyo: la plata entró dos veces. Sólo códigos.
      const actual = await tx.fotofficePrintOrder.findUnique({ where: { id }, select: { providerPaymentRef: true } });
      if (actual?.providerPaymentRef && actual.providerPaymentRef !== hechos.providerPaymentId) {
        console.warn("[impresiones] pago duplicado", { pedidoId: id, ref: hechos.providerPaymentId });
      }
      return { yaEstaba: true };
    }

    // El cliente: los pedidos desde la carpeta ya lo traen. Si faltara, se busca o se crea con los datos
    // del pedido (nunca se corta acá: el pago ya quedó registrado).
    let clientId = pedido.clientId;
    if (!clientId) {
      const c = await findOrCreateClient(tx, { workspaceId, email: pedido.email, phone: pedido.telefono, ...partirNombre(pedido.nombre) });
      clientId = c.id;
      await tx.fotofficePrintOrder.update({ where: { id }, data: { clientId } });
    }

    const trabajos = await crearTrabajosEnTransaccion(tx, workspaceId, { id, number: pedido.number, clientId, hoy, prometido, items: pedido.items });
    if (!trabajos) await tx.fotofficePrintOrder.update({ where: { id }, data: { lastError: SIN_CIRCUITO } });

    // Caja. Nunca inventa una cuenta: sin cuenta no hay movimiento, pero el pago no se pierde.
    if (cajaEncendida) {
      const cuentas = await tx.cashAccount.findMany({
        where: { workspaceId, isActive: true },
        select: { id: true, name: true, kind: true, isDefault: true, isVault: true },
        orderBy: { order: "asc" },
      });
      const destino = resolveDepositTarget({ cashEnabled: true, paymentMethod: "MERCADO_PAGO", accounts: cuentas, categories: [], categoryName: "" });
      if (destino.ok) {
        const mov = await recordCashMovement(tx, {
          workspaceId,
          accountId: destino.accountId,
          kind: "INGRESO",
          amountMinor: totalCents,
          occurredAt: paidAt,
          description: `Copias impresas · pedido ${pedido.number} · ${pedido.nombre}`,
          sourceModule: "impresiones",
          sourceRef: id,
          clientId,
          paymentMethod: "MERCADO_PAGO",
          createdByUserId: null,
        });
        await tx.fotofficePrintOrder.update({ where: { id }, data: { cashMovementId: mov.id } });
      }
    }
    return { yaEstaba: false };
  }, OPCIONES_TRANSACCION);

  if (!resultado.yaEstaba) programar(() => avisarPedidoConfirmado(workspaceId, id));
  return { ok: true, yaEstaba: resultado.yaEstaba };
}

// --- Vuelta del comprador -----------------------------------------------------------------------------------

export type ResultadoVueltaImpresion = { estado: "PAGADO" | "PENDIENTE" | "RECHAZADO"; seguimiento: string | null };

const ESTADOS_PAGADOS = new Set(["PAGADO", "PREPARANDO", "ENVIADO", "PAGADO_SIN_ENVIAR"]);
const PAGO_EN_CURSO = new Set(["pending", "in_process", "authorized"]);

function pagoEnCurso(pago: { status: string; rawSanitized: Record<string, unknown> }): boolean {
  const crudo = pago.rawSanitized.status;
  if (typeof crudo === "string") return PAGO_EN_CURSO.has(crudo.toLowerCase());
  return pago.status === "PENDING";
}

/**
 * A la vuelta del comprador: la dirección no se cree. El pedido tiene que ser de ESTE estudio; el pago se le
 * pregunta a Mercado Pago con el token del estudio (el `payment_id` de la dirección o, sin él, la búsqueda por
 * la referencia del pedido) y, si está aprobado y es de este pedido, se acredita. `seguimiento` es el token
 * de seguimiento del pedido (null si el pedido no es de este estudio). Nunca lanza.
 */
export async function verificarVueltaImpresion(workspaceId: string, pedidoId: unknown, paymentId: unknown): Promise<ResultadoVueltaImpresion> {
  if (!idValido(pedidoId)) return { estado: "RECHAZADO", seguimiento: null };
  let seguimiento: string | null = null;
  try {
    const pedido = await prisma.fotofficePrintOrder.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true, status: true, trackingToken: true } });
    if (!pedido) return { estado: "RECHAZADO", seguimiento: null };
    seguimiento = pedido.trackingToken;
    if (ESTADOS_PAGADOS.has(pedido.status)) return { estado: "PAGADO", seguimiento };

    const collector = await resolveWorkspaceCollector(workspaceId);
    // Sin cobros no se puede consultar: si pagó, lo confirma el aviso.
    if (!collector.ok) return { estado: "PENDIENTE", seguimiento };
    const adapter = createMercadoPagoCheckoutProLiveAdapter({ accessToken: collector.collector.accessToken });
    let pago: PagoMp | null;
    try {
      pago = paymentIdValido(paymentId) ? await adapter.getPayment(paymentId) : await adapter.searchPaymentsByExternalReference(referenciaPedido(pedido.id));
    } catch (error) {
      // Un `payment_id` inventado, o de otra cuenta, también cae acá; o Mercado Pago no respondió.
      console.warn("[impresiones] no se pudo consultar el pago en Mercado Pago", { detalle: sanitizeError(error) });
      return { estado: "PENDIENTE", seguimiento };
    }
    if (!pago || pedidoDeReferencia(pago.externalReference) !== pedido.id) return { estado: "RECHAZADO", seguimiento };
    if (pagoEnCurso(pago)) return { estado: "PENDIENTE", seguimiento };
    if (!pagoAprobado(pago)) return { estado: "RECHAZADO", seguimiento };

    const r = await acreditarPagoImpresion(workspaceId, pago);
    if (r.ok) return { estado: "PAGADO", seguimiento };
    // Aprobado pero sin acreditar (importe menor, otra moneda): la plata llegó; que no vuelva a pagar.
    console.warn("[impresiones] pago aprobado sin acreditar en la vuelta", { codigo: r.error });
    return { estado: "PENDIENTE", seguimiento };
  } catch (error) {
    console.error("[impresiones] falló la verificación de la vuelta", { detalle: sanitizeError(error) });
    return { estado: "PENDIENTE", seguimiento };
  }
}
