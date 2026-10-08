import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { diaDeCalendario } from "@/lib/consultas/fechas";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { bloquearPresupuesto, itemsGuardados, type TotalesGuardados } from "@/lib/presupuestos/versiones";
import { MENSAJES_PEDIDO, puedeGestionarPedidos, type CtxPedidos } from "./acceso";
import { buscarOpcion, opcionesParaPresupuesto, parsePaymentOptionsSnapshot, type OpcionPago } from "./opciones-pago";
import { leerCuotasEditadas, type CuotaParaGuardar } from "./plan";
import { planDesdeOpcion, validarPlan, type AvisoPlan, type CuotaPlan } from "./plan-cuotas";
import { etiquetaDeEvento, insertarPedido, nombreDeContacto, rubroDeItems } from "./pedidos";

/**
 * "Confirmar pedido" desde un presupuesto aceptado (spec §2 A.2 y §5).
 *
 * En una sola transacción, con el candado del presupuesto (el mismo de guardar, versionar,
 * enviar y aceptar):
 * - el presupuesto tiene que ser del workspace, estar ACEPTADO y no tener pedido;
 * - copia `items` y `totals` de la versión aceptada;
 * - el total es el de la opción de pago elegida: el financiado si tiene interés, el de contado
 *   con su descuento, o el del presupuesto. Una versión sin opciones congeladas (enviada antes de
 *   la etapa 3) toma la de por omisión, calculada ahora;
 * - copia la fecha del evento (día de Argentina) y una etiqueta corta (categoría · contacto);
 * - asigna el número `PEDIDO`;
 * - arma el plan desde la opción, o el plan ajustado en la vista previa (validado contra el total);
 * - apaga `pedidoPorConfirmar`;
 * - rubro de ingreso: el del primer ítem de catálogo que tenga uno; responsable: el del presupuesto.
 *
 * Un presupuesto genera un solo pedido: el único `presupuestoId` decide la carrera. Quien pierde
 * recibe `{ ok: false, error: "Ya tiene pedido", pedidoId }` con el pedido que ganó.
 */

type Tx = Prisma.TransactionClient;
type Lector = Pick<
  Tx,
  | "fotofficePresupuesto"
  | "fotofficePresupuestoVersion"
  | "fotofficePedido"
  | "fotofficeConsulta"
  | "fotofficeConsultaCategoria"
  | "client"
  | "fotofficeProductoCatalogo"
  | "cashCategory"
>;

export type DepsConfirmar = { ahora?: () => Date };

export type ResultadoConfirmacion =
  | { ok: true; pedidoId: string; numero: string; aviso: AvisoPlan | null }
  | { ok: false; error: string; pedidoId?: string };

/** Lo que se va a crear: la vista previa lo muestra y la confirmación lo escribe. */
export type ConfirmacionPreparada = {
  presupuestoId: string;
  acceptedVersionId: string;
  consultaLeadId: string;
  clientId: string;
  ownerUserId: number | null;
  items: unknown;
  totals: TotalesGuardados | null;
  /** El total del presupuesto (precio de lista, antes de la opción de pago). */
  totalPresupuesto: number;
  /** El total del pedido: el de la opción elegida. */
  total: number;
  opcion: OpcionPago | null;
  fechaEvento: string | null;
  eventLabel: string | null;
  cuotas: CuotaPlan[];
  aviso: AvisoPlan | null;
  incomeCategoryId: string | null;
};

class Corte extends Error {
  constructor(readonly mensaje: string, readonly pedidoId?: string) {
    super(mensaje);
  }
}

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function totalDe(totals: unknown): number {
  const t = (totals as { total?: unknown } | null)?.total;
  return typeof t === "number" && Number.isFinite(t) && t > 0 ? t : 0;
}

/** Lee y arma todo lo del pedido sin escribir nada. Lanza `Corte` si no se puede confirmar. */
async function preparar(cliente: Lector, workspaceId: string, presupuestoId: string, ahora: Date): Promise<ConfirmacionPreparada> {
  const p = await cliente.fotofficePresupuesto.findFirst({
    where: { id: presupuestoId, workspaceId },
    select: { id: true, status: true, acceptedVersionId: true, consultaLeadId: true, clientId: true, ownerUserId: true },
  });
  if (!p) throw new Corte(MENSAJES_PEDIDO.presupuesto);
  const ya = await cliente.fotofficePedido.findFirst({ where: { presupuestoId, workspaceId }, select: { id: true } });
  if (ya) throw new Corte(MENSAJES_PEDIDO.yaTienePedido, ya.id);
  if (p.status !== "ACEPTADO" || !p.acceptedVersionId) throw new Corte(MENSAJES_PEDIDO.noAceptado);
  const v = await cliente.fotofficePresupuestoVersion.findFirst({
    where: { id: p.acceptedVersionId, workspaceId, presupuestoId },
    select: { id: true, items: true, totals: true, paymentOptions: true, chosenPaymentOptionId: true },
  });
  if (!v) throw new Corte(MENSAJES_PEDIDO.noAceptado);

  const [consulta, contacto] = await Promise.all([
    cliente.fotofficeConsulta.findFirst({ where: { leadId: p.consultaLeadId, workspaceId }, select: { eventStartsAt: true, categoryId: true } }),
    cliente.client.findFirst({ where: { id: p.clientId, workspaceId }, select: { firstName: true, lastName: true, businessName: true } }),
  ]);
  const categoria = consulta
    ? await cliente.fotofficeConsultaCategoria.findFirst({ where: { id: consulta.categoryId, workspaceId }, select: { name: true } })
    : null;
  const fechaEvento = consulta?.eventStartsAt ? diaDeCalendario(consulta.eventStartsAt) : null;
  const eventLabel = etiquetaDeEvento([categoria?.name, contacto ? nombreDeContacto(contacto) : null]);

  const hoy = diaEnBuenosAires(ahora);
  const totalPresupuesto = totalDe(v.totals);
  let opcion: OpcionPago | null = null;
  if (totalPresupuesto > 0) {
    // Sin instantánea (versión vieja): la opción por omisión, calculada ahora sobre su total.
    const snapshot = parsePaymentOptionsSnapshot(v.paymentOptions) ?? opcionesParaPresupuesto(null, totalPresupuesto, fechaEvento, hoy, ahora.toISOString());
    opcion = buscarOpcion(snapshot, v.chosenPaymentOptionId) ?? buscarOpcion(snapshot, null);
  }
  const total = opcion ? opcion.total : totalPresupuesto;
  const plan = opcion && total > 0 ? planDesdeOpcion(opcion, { desde: hoy, fechaEvento }) : { cuotas: [], aviso: null };
  const items = itemsGuardados(v.items);
  const incomeCategoryId = await rubroDeItems(cliente, workspaceId, items);

  return {
    presupuestoId,
    acceptedVersionId: v.id,
    consultaLeadId: p.consultaLeadId,
    clientId: p.clientId,
    ownerUserId: p.ownerUserId,
    items: v.items,
    totals: (v.totals as TotalesGuardados | null) ?? null,
    totalPresupuesto,
    total,
    opcion,
    fechaEvento,
    eventLabel,
    cuotas: plan.cuotas,
    aviso: plan.aviso,
    incomeCategoryId,
  };
}

export type VistaPreviaConfirmacion =
  | { ok: true; vista: Omit<ConfirmacionPreparada, "items" | "totals" | "ownerUserId"> }
  | { ok: false; error: string; pedidoId?: string };

/** Lo que se va a crear (sobre todo el plan, para ajustarlo antes de confirmar). No escribe nada. */
export async function vistaPreviaConfirmacion(ctx: CtxPedidos, presupuestoId: unknown, deps: DepsConfirmar = {}): Promise<VistaPreviaConfirmacion> {
  if (!puedeGestionarPedidos(ctx)) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  if (!idValido(presupuestoId)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  try {
    const d = await preparar(prisma, ctx.workspaceId, presupuestoId, deps.ahora?.() ?? new Date());
    // Sin los ítems (pueden traer costos) ni el responsable: sólo lo del plan.
    return {
      ok: true,
      vista: {
        presupuestoId: d.presupuestoId,
        acceptedVersionId: d.acceptedVersionId,
        consultaLeadId: d.consultaLeadId,
        clientId: d.clientId,
        totalPresupuesto: d.totalPresupuesto,
        total: d.total,
        opcion: d.opcion,
        fechaEvento: d.fechaEvento,
        eventLabel: d.eventLabel,
        cuotas: d.cuotas,
        aviso: d.aviso,
        incomeCategoryId: d.incomeCategoryId,
      },
    };
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje, ...(e.pedidoId ? { pedidoId: e.pedidoId } : {}) };
    throw e;
  }
}

function falla(donde: string, error: unknown): void {
  const e = error as { code?: unknown } | null;
  console.error(`[pedidos] ${donde} falló`, { codigo: typeof e?.code === "string" ? e.code : null });
}

/**
 * Confirma el pedido de un presupuesto aceptado. `planAjustado`: el plan editado en la vista previa
 * (fecha, importe y medio sugerido de cada cuota; sin ids), que tiene que sumar el total.
 */
export async function confirmarPedido(
  ctx: CtxPedidos,
  presupuestoId: unknown,
  planAjustado?: unknown,
  deps: DepsConfirmar = {},
): Promise<ResultadoConfirmacion> {
  if (!puedeGestionarPedidos(ctx) || ctx.userId === null) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  if (!idValido(presupuestoId)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  let ajustado: CuotaParaGuardar[] | null = null;
  if (planAjustado !== undefined && planAjustado !== null) {
    const p = leerCuotasEditadas(planAjustado);
    if (!p.ok) return p;
    ajustado = p.valor.map((c) => ({ dueDate: c.dueDate, amountArs: c.amountArs, suggestedMethod: c.suggestedMethod }));
  }
  const { workspaceId } = ctx;
  const ahora = deps.ahora?.() ?? new Date();

  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoConfirmacion> => {
      await bloquearPresupuesto(tx, presupuestoId);
      const d = await preparar(tx, workspaceId, presupuestoId, ahora);
      let cuotas: CuotaParaGuardar[] = d.cuotas;
      let aviso = d.aviso;
      if (ajustado) {
        const suma = validarPlan(ajustado, d.total);
        if (!suma.ok) throw new Corte(suma.error);
        cuotas = ajustado;
        aviso = null;
      }
      const r = await insertarPedido(tx, {
        workspaceId,
        presupuestoId,
        acceptedVersionId: d.acceptedVersionId,
        consultaLeadId: d.consultaLeadId,
        clientId: d.clientId,
        items: d.items,
        totals: d.totals,
        total: d.total,
        paymentOption: d.opcion,
        eventDate: d.fechaEvento,
        eventLabel: d.eventLabel,
        incomeCategoryId: d.incomeCategoryId,
        ownerUserId: d.ownerUserId,
        createdByUserId: ctx.userId,
        cuotas,
        ahora,
      });
      await tx.fotofficePresupuesto.updateMany({ where: { id: presupuestoId, workspaceId }, data: { pedidoPorConfirmar: false, updatedAt: ahora } });
      return { ok: true, pedidoId: r.id, numero: r.numero, aviso };
    });
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje, ...(e.pedidoId ? { pedidoId: e.pedidoId } : {}) };
    // Otra confirmación del mismo presupuesto ganó (único `presupuestoId`): devolver la suya.
    if ((e as { code?: unknown } | null)?.code === "P2002") {
      const ganador = await prisma.fotofficePedido.findFirst({ where: { presupuestoId, workspaceId }, select: { id: true } });
      if (ganador) return { ok: false, error: MENSAJES_PEDIDO.yaTienePedido, pedidoId: ganador.id };
    }
    falla("confirmarPedido", e);
    return { ok: false, error: MENSAJES_PEDIDO.fallo };
  }
}
