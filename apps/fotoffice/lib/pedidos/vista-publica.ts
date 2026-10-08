/**
 * Lo que ve el cliente en el enlace público de su pedido y de cada recibo (etapa 3, spec §2 A.5,
 * A.6 y §3.3). Módulo PURO.
 *
 * `armarVistaPedido` y `armarVistaRecibo` copian campo por campo SÓLO lo que se puede mostrar,
 * igual que `lib/presupuestos/vista-publica.ts`:
 *
 * - del ítem: nombre, descripción, cantidad, precio, descuento, neto, sección y si es opcional.
 *   Nunca la instantánea del cálculo (costos y márgenes), el modo de precio ni el producto;
 * - del pedido: número, estado, evento, totales, forma de pago, plan y recibos. Nunca el motivo de
 *   la cancelación, el responsable, el rubro, el contacto ni el presupuesto de origen;
 * - del recibo: nunca el motivo de la anulación ni ids internos.
 *
 * Así, aunque mañana se sumen campos internos a la base, no llegan solos a la página.
 */
import type { Descuento, ItemPresupuesto } from "@/lib/presupuestos/constantes";
import type { TotalesGuardados } from "@/lib/presupuestos/versiones";
import { ETIQUETA_ESTADO_CUOTA, ETIQUETA_ESTADO_PEDIDO, type EstadoCuota, type EstadoPedido } from "./constantes";
import type { CuotaConEstado, ResumenPlan } from "./estado";

export type OrganizacionPublica = { nombre: string; logoUrl: string | null; whatsappUrl: string | null; email: string | null };

export type ItemPublicoPedido = {
  id: string;
  nombre: string;
  descripcion: string | null;
  cantidad: number;
  precioUnitario: number;
  descuento: Descuento | null;
  neto: number;
  seccion: string | null;
  opcional: boolean;
};

export type CuotaPublica = {
  numero: number;
  /** "dd/mm/aaaa". */
  vence: string;
  importe: number;
  cobrado: number;
  saldo: number;
  estado: EstadoCuota;
  estadoEtiqueta: string;
};

export type ReciboEnLista = {
  numero: string;
  /** "dd/mm/aaaa". */
  fecha: string;
  importe: number;
  medio: string;
  anulado: boolean;
  /** Enlace a la página pública del recibo; null si no se pudo armar. */
  url: string | null;
};

export type VistaPedidoPublica = {
  organizacion: OrganizacionPublica;
  numero: string;
  estado: EstadoPedido;
  estadoEtiqueta: string;
  evento: { fecha: string | null; etiqueta: string | null };
  items: ItemPublicoPedido[];
  totales: { subtotal: number; descuentos: number; totalItems: number; opcionales: number; cantidadOpcionales: number };
  /** La forma de pago elegida, y el interés de financiación si lo tiene. */
  formaDePago: { etiqueta: string; interes: number } | null;
  plan: { total: number; cobrado: number; saldo: number; vencido: number; cuotas: CuotaPublica[] };
  recibos: ReciboEnLista[];
};

export type VistaReciboPublica = {
  organizacion: OrganizacionPublica;
  numero: string;
  /** "dd/mm/aaaa". */
  fecha: string;
  cliente: string;
  concepto: string;
  importe: number;
  importeEnLetras: string;
  medio: string;
  cuotas: { numero: number; vence: string; importe: number }[];
  anulado: boolean;
  leyenda: string;
};

const numero = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** "aaaa-mm-dd" → "dd/mm/aaaa". */
export function ddmmaaaa(ymd: string): string {
  return ymd.split("-").reverse().join("/");
}

function organizacion(o: OrganizacionPublica): OrganizacionPublica {
  return { nombre: o.nombre, logoUrl: o.logoUrl, whatsappUrl: o.whatsappUrl, email: o.email };
}

function cuotaPublica(c: CuotaConEstado): CuotaPublica {
  return {
    numero: c.position,
    vence: ddmmaaaa(c.dueDate),
    importe: c.amountArs,
    cobrado: c.imputado,
    saldo: c.saldo,
    estado: c.estado,
    estadoEtiqueta: ETIQUETA_ESTADO_CUOTA[c.estado],
  };
}

export function armarVistaPedido(args: {
  organizacion: OrganizacionPublica;
  numero: string;
  estado: EstadoPedido;
  eventDate: string | null;
  eventLabel: string | null;
  items: readonly ItemPresupuesto[];
  totals: TotalesGuardados | null;
  formaDePago: { etiqueta: string; interes: number } | null;
  plan: ResumenPlan;
  recibos: readonly ReciboEnLista[];
}): VistaPedidoPublica {
  const t = args.totals;
  const renglones = t?.renglones ?? {};
  return {
    organizacion: organizacion(args.organizacion),
    numero: args.numero,
    estado: args.estado,
    estadoEtiqueta: ETIQUETA_ESTADO_PEDIDO[args.estado],
    evento: { fecha: args.eventDate ? ddmmaaaa(args.eventDate) : null, etiqueta: args.eventLabel },
    items: args.items.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
      descuento: i.descuento ? { tipo: i.descuento.tipo, valor: i.descuento.valor } : null,
      neto: numero(renglones[i.id]?.neto),
      seccion: i.seccion,
      opcional: i.opcional,
    })),
    totales: {
      subtotal: numero(t?.subtotal),
      descuentos: numero(t?.descuentoItems) + numero(t?.descuentoGlobal),
      totalItems: numero(t?.total),
      opcionales: numero(t?.opcionales?.total),
      cantidadOpcionales: numero(t?.opcionales?.cantidad),
    },
    formaDePago: args.formaDePago ? { etiqueta: args.formaDePago.etiqueta, interes: numero(args.formaDePago.interes) } : null,
    plan: {
      total: args.plan.total,
      cobrado: args.plan.cobrado,
      saldo: args.plan.saldo,
      vencido: args.plan.vencido,
      cuotas: args.plan.cuotas.map(cuotaPublica),
    },
    recibos: args.recibos.map((r) => ({ numero: r.numero, fecha: r.fecha, importe: r.importe, medio: r.medio, anulado: r.anulado, url: r.url })),
  };
}

/** Lo que llega de `leerRecibo` (sin el motivo de la anulación) y la marca de la organización. */
export function armarVistaRecibo(args: {
  organizacion: OrganizacionPublica;
  recibo: {
    numero: string;
    fecha: string;
    cliente: string;
    concepto: string;
    importe: number;
    importeEnLetras: string;
    medioEtiqueta: string;
    cuotas: readonly { position: number; dueDate: string; amountArs: number }[];
    anulado: boolean;
    leyenda: string;
  };
}): VistaReciboPublica {
  const r = args.recibo;
  return {
    organizacion: organizacion(args.organizacion),
    numero: r.numero,
    fecha: ddmmaaaa(r.fecha),
    cliente: r.cliente,
    concepto: r.concepto,
    importe: r.importe,
    importeEnLetras: r.importeEnLetras,
    medio: r.medioEtiqueta,
    cuotas: r.cuotas.map((c) => ({ numero: c.position, vence: ddmmaaaa(c.dueDate), importe: c.amountArs })),
    anulado: r.anulado,
    leyenda: r.leyenda,
  };
}
