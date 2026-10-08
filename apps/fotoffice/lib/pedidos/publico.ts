import "server-only";
import { prisma } from "@repo/db";
import { buildWhatsappUrl } from "@/lib/contact/whatsapp";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { sitioDelWorkspace, type SitioDelPresupuesto } from "@/lib/presupuestos/sitio";
import { itemsGuardados, type TotalesGuardados } from "@/lib/presupuestos/versiones";
import { ETIQUETA_MEDIO_COBRO, esEstadoPedido, esMedioCobro } from "./constantes";
import { enlacesDeRecibos, resolverTokenPedido, resolverTokenRecibo, type DepsEnlace } from "./enlace";
import { resumenDePlan } from "./estado";
import { idDeCuotaValido, paymentIdValido } from "./mp-puro";
import { verificarPagoCuota, type VerificacionPago } from "./mp";
import { fechaDeBase, pesosDeBase, planesDe } from "./plan";
import { leerRecibo } from "./recibos";
import {
  armarVistaPedido, armarVistaRecibo, ddmmaaaa, type OrganizacionPublica, type VistaPedidoPublica, type VistaReciboPublica,
} from "./vista-publica";

/**
 * Los enlaces públicos `/<slug>/pedido/<token>` y `/<slug>/recibo/<token>` (etapa 3, spec §2 A.5,
 * A.6 y §3.3), sin sesión: el token es la llave y el workspace sale del slug de la dirección (el
 * token tiene que ser de ESE workspace). Mismo criterio que `lib/presupuestos/publico.ts`.
 *
 * - Token sin forma, desconocido, de otro workspace o de la otra clase (un recibo en la ruta del
 *   pedido, o al revés): null, y la página responde "Enlace no disponible" (404). Los tokens del
 *   pedido y del recibo firman mensajes con propósitos distintos (`lib/pedidos/enlace.ts`).
 * - Un enlace del pedido renovado ("rotar") deja de abrir: su hash ya no está guardado.
 * - Un recibo anulado sigue abriendo, con el sello "ANULADO" y sin el motivo.
 * - Las lecturas usan `select` explícitos (abajo): nunca `items` con costos para mostrar tal cual,
 *   ni el motivo de cancelación o de anulación, ni el responsable, ni datos de otros pedidos.
 */

/** Lo único que se lee de un pedido para el público. */
export const SELECT_PEDIDO_PUBLICO = {
  id: true,
  number: true,
  status: true,
  items: true,
  totals: true,
  totalArs: true,
  paymentOption: true,
  eventDate: true,
  eventLabel: true,
} as const;

/** Lo único que se lee de los cobros del pedido para la lista de recibos. */
export const SELECT_COBRO_PUBLICO = {
  id: true,
  receiptNumber: true,
  paidAt: true,
  method: true,
  amountArs: true,
  voidedAt: true,
} as const;

export type DepsPublico = DepsEnlace & { ahora?: () => Date };

function marca(sitio: SitioDelPresupuesto, consulta: string): OrganizacionPublica {
  return {
    nombre: sitio.nombre,
    logoUrl: sitio.logoUrl && /^https:\/\//i.test(sitio.logoUrl) ? sitio.logoUrl : null,
    whatsappUrl: buildWhatsappUrl(sitio.whatsapp, consulta),
    email: sitio.email,
  };
}

/** La forma de pago guardada en el pedido: sólo su nombre y el interés de financiación. */
function formaDePago(raw: unknown): { etiqueta: string; interes: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { etiqueta?: unknown; interes?: unknown };
  if (typeof o.etiqueta !== "string" || !o.etiqueta.trim()) return null;
  return { etiqueta: o.etiqueta.trim(), interes: typeof o.interes === "number" && Number.isFinite(o.interes) ? o.interes : 0 };
}

/** El pedido de un token del workspace, como lo ve el cliente; null = "Enlace no disponible". */
export async function abrirPedidoPublico(workspaceId: string, token: unknown, deps: DepsPublico = {}): Promise<VistaPedidoPublica | null> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const r = await resolverTokenPedido(workspaceId, token);
  if (!r) return null;
  const p = await prisma.fotofficePedido.findFirst({ where: { id: r.pedidoId, workspaceId }, select: SELECT_PEDIDO_PUBLICO });
  if (!p || !esEstadoPedido(p.status)) return null;
  const sitio = await sitioDelWorkspace(workspaceId);
  if (!sitio) return null;
  // Sólo el sí o el no: el cobrador (y su token) se resuelve en el servidor y no sale de acá.
  const cobrosHabilitados = p.status !== "CANCELADO" && (await resolveWorkspaceCollector(workspaceId).then((r) => r.ok, () => false));

  const [planes, cobros] = await Promise.all([
    planesDe(workspaceId, [p.id]),
    prisma.fotofficeCobro.findMany({ where: { workspaceId, pedidoId: p.id }, orderBy: [{ paidAt: "asc" }], select: SELECT_COBRO_PUBLICO }),
  ]);
  // Las direcciones de los recibos se rearman en el servidor (token HMAC con la clave), sólo para
  // los cobros de ESTE pedido y sólo después de validar el token del pedido. Si no hay clave o
  // sitio, la lista sale igual, sin enlaces.
  const enlaces = cobros.length ? await enlacesDeRecibos(workspaceId, cobros.map((c) => c.id), deps) : null;
  const urls = enlaces?.ok ? enlaces.urls : new Map<string, string>();
  const plan = planes.get(p.id) ?? { cuotas: [], imputaciones: [] };

  return armarVistaPedido({
    organizacion: marca(sitio, `Hola, tengo una consulta sobre el pedido N° ${p.number}.`),
    numero: p.number,
    estado: p.status,
    eventDate: p.eventDate ? fechaDeBase(p.eventDate) : null,
    eventLabel: p.eventLabel,
    items: itemsGuardados(p.items),
    totals: (p.totals as TotalesGuardados | null) ?? null,
    formaDePago: formaDePago(p.paymentOption),
    plan: resumenDePlan(plan.cuotas, plan.imputaciones, { hoy: diaEnBuenosAires(ahora), estadoPedido: p.status, total: pesosDeBase(p.totalArs) }),
    cobrosHabilitados,
    recibos: cobros.map((c) => ({
      numero: c.receiptNumber,
      fecha: ddmmaaaa(diaEnBuenosAires(c.paidAt)),
      importe: pesosDeBase(c.amountArs),
      medio: esMedioCobro(c.method) ? ETIQUETA_MEDIO_COBRO[c.method] : "Otro",
      anulado: c.voidedAt !== null,
      url: urls.get(c.id) ?? null,
    })),
  });
}

/** El recibo de un token del workspace (anulado también); null = "Enlace no disponible". */
export async function abrirReciboPublico(workspaceId: string, token: unknown): Promise<VistaReciboPublica | null> {
  const r = await resolverTokenRecibo(workspaceId, token);
  if (!r) return null;
  const [recibo, sitio] = await Promise.all([leerRecibo(workspaceId, r.cobroId), sitioDelWorkspace(workspaceId)]);
  if (!recibo || !sitio) return null;
  return armarVistaRecibo({ organizacion: marca(sitio, `Hola, tengo una consulta sobre el recibo N° ${recibo.numero}.`), recibo });
}

/**
 * La vuelta de Mercado Pago a la página del pedido (`?pago=ok&cuota=…&payment_id=…`): la dirección
 * no se cree. Se valida el token del pedido, la forma del `payment_id` y que la cuota sea de ESE
 * pedido, y se le pregunta a Mercado Pago. null = no hay nada para verificar.
 */
export async function verificarVueltaDePago(
  workspaceId: string,
  token: unknown,
  datos: { cuotaId: unknown; paymentId: unknown },
): Promise<VerificacionPago | null> {
  if (!idDeCuotaValido(datos.cuotaId)) return null;
  const paymentId = paymentIdValido(datos.paymentId) ? datos.paymentId : null;
  const r = await resolverTokenPedido(workspaceId, token);
  if (!r) return null;
  return verificarPagoCuota({ workspaceId, pedidoId: r.pedidoId, cuotaId: datos.cuotaId, providerPaymentId: paymentId });
}
