import type { Descuento, ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { calcularTotales, type TotalesPresupuesto } from "@/lib/presupuestos/totales";
import { DUDAS } from "../campos";
import { campos, clave, esObjeto, fecha, idAlboom, importe, siNo, texto, textoLargo } from "../normalizar";
import type { Campos, Crudo, Decision, EntradaMapa } from "../tipos";
import {
  CORTE_FOTOFFICE,
  DUDAS_8B2,
  MOTIVOS_8B2,
  importeConSigno,
  instanteAr,
  medioDePago,
  notaDeAlboom,
  padreDe,
  renglon,
  usuario,
  yaCargado,
  type Medio,
} from "./historia";

/**
 * Presupuestos, pedidos, plan de cuotas y costos de los pedidos de Alboom (doc 02 §17) → FOTOFFICE. Puro.
 *
 * - Presupuesto → `FotofficePresupuesto` + su V1 (ítems y totales como instantánea, sin token: no hay enlace público).
 * - Pedido → `FotofficePedido` con el número de Alboom, ítems, totales y contratantes, sin token público. Nunca pasa
 *   por `confirmarPedido`: no crea proyectos, citas, cuentas ni avisos, ni manda nada al laboratorio.
 * - Cuota → `FotofficePedidoCuota` (el escritor la marca como ya avisada para el recordatorio).
 * - Costo del pedido → `FotofficeCuentaPagar` del pedido; si estaba pagado, pagado SIN movimiento de Caja, con la
 *   fecha y el medio del pago de Alboom del mismo pedido e importe (que queda atado en el mapa y no se vuelve a cargar).
 */

export const TIPO_PRESUPUESTO = "PRESUPUESTO";
export const TIPO_PEDIDO = "PEDIDO";
export const TIPO_CUOTA = "PEDIDO_CUOTA";
export const TIPO_CUENTA_PAGAR = "CUENTA_PAGAR";

const MAX_IMPORTE = 999_999_999.99;
const MAX_CANTIDAD = 100_000;
const MAX_ITEMS = 200;

/** Estados de pedido (doc 02 §2). */
export const ESTADO_PEDIDO: Record<string, string> = { "471": "Abierto", "474": "Cancelado", "475": "Venta Completada", "476": "Pedido Rápido" };

// ── Ítems y totales (mismo formato en presupuestos y pedidos) ────────────────────

const num = (v: unknown): number | null => {
  const i = importe(v);
  return i === null ? null : Number(i);
};

/** Renglones de Alboom (`quote_items`/`order_items`: `product_id, code, name, description, price, qty, discount %`) → ítems. */
export function itemsDeAlboom(filas: unknown[], productoDe: Map<string, string>, gastos: unknown): ItemPresupuesto[] {
  const items: ItemPresupuesto[] = [];
  for (const f of filas.slice(0, MAX_ITEMS)) {
    if (!esObjeto(f)) continue;
    const nombre = texto(f.name, 200) ?? texto(f.code, 200) ?? "Ítem de Alboom";
    const cantidad = Math.min(MAX_CANTIDAD, Math.max(0, num(f.qty) ?? 1));
    const precio = Math.min(MAX_IMPORTE, num(f.price) ?? 0);
    const pct = num(f.discount) ?? 0;
    const idProducto = idAlboom(f.product_id);
    items.push({
      id: `alb-${items.length + 1}`,
      productId: idProducto ? (productoDe.get(idProducto) ?? null) : null,
      nombre,
      descripcion: textoLargo(f.description, 2000),
      cantidad,
      precioUnitario: precio,
      descuento: pct > 0 ? { tipo: "PORCENTAJE", valor: Math.min(100, pct) } : null,
      modoPrecio: "LISTA",
      calculo: null,
      seccion: null,
      opcional: false,
    });
  }
  const otros = num(gastos);
  if (otros !== null && otros > 0) {
    items.push({ id: `alb-${items.length + 1}`, productId: null, nombre: "Otros gastos", descripcion: null, cantidad: 1, precioUnitario: Math.min(MAX_IMPORTE, otros), descuento: null, modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false });
  }
  return items;
}

/** Descuento global de Alboom: `discount` en pesos (o en % si `discount_percent`). */
export function descuentoDeAlboom(p: Record<string, unknown>): Descuento | null {
  const d = num(p.discount);
  if (d === null || d <= 0) return null;
  return siNo(p.discount_percent) ? { tipo: "PORCENTAJE", valor: Math.min(100, d) } : { tipo: "MONTO", valor: d };
}

function filasDe(...fuentes: unknown[]): unknown[] {
  for (const f of fuentes) {
    if (Array.isArray(f) && f.length > 0) return f;
    if (esObjeto(f) && Object.keys(f).length > 0) return Object.values(f);
  }
  return [];
}

/** El registro del detalle (a veces viene envuelto en `quote`/`order`) sobre el del listado. */
function unir(listado: Record<string, unknown>, detalle: Record<string, unknown> | undefined, envoltorio: string): Record<string, unknown> {
  if (!detalle) return listado;
  const d = esObjeto(detalle[envoltorio]) ? (detalle[envoltorio] as Record<string, unknown>) : detalle;
  return { ...listado, ...d };
}

function totalesYDuda(items: ItemPresupuesto[], global: Descuento | null, totalAlboom: unknown, dudas: string[]): TotalesPresupuesto {
  const totals = calcularTotales(items, global);
  const t = num(totalAlboom);
  if (t !== null && Math.abs(t - totals.total) >= 0.01) dudas.push(DUDAS_8B2.totalDistinto);
  return totals;
}

// ── Presupuestos ────────────────────────────────────────────────────────────────

export type CtxPresupuestos = {
  leadDe: Map<string, string>;
  clienteDeLead: Map<string, string>;
  contactoDe: Map<string, string>;
  productoDe: Map<string, string>;
  usuarioDe: Map<string, string>;
  /** Detalle de cada presupuesto (`presupuestos_detalle`, con `quote_items`). */
  detalle: Map<string, Record<string, unknown>>;
  /** Presupuestos de Alboom que algún pedido usa (`quote_id`): quedan ACEPTADOS. */
  aceptados: Set<string>;
  /** Hoy ("aaaa-mm-dd", Argentina), para marcar vencidos. */
  hoy: string;
  existentes: Set<string>;
  mapa: Map<string, EntradaMapa>;
};

function sumarDias(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function traducirPresupuesto(c: Crudo, ctx: CtxPresupuestos): Decision {
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const p = unir(campos(c.payload), ctx.detalle.get(c.alboomId), "quote");
  const idLead = idAlboom(p.lead_id);
  const lead = idLead ? ctx.leadDe.get(idLead) : undefined;
  if (!idLead || !lead) return { accion: "OMITIR", motivo: MOTIVOS_8B2.consultaSinCargar };
  const idCliente = idAlboom(p.customer_id);
  const clientId = (idCliente ? ctx.contactoDe.get(idCliente) : undefined) ?? ctx.clienteDeLead.get(idLead);
  if (!clientId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.contactoSinCargar };
  const dudas: string[] = [];
  const items = itemsDeAlboom(filasDe(p.quote_items, p.items), ctx.productoDe, p.other_expenses);
  const totals = totalesYDuda(items, descuentoDeAlboom(p), p.total, dudas);
  const creado = instanteAr(p.created) ?? instanteAr(p.modified);
  const dia = fecha(p.created);
  const dias = Number(texto(p.valid_thru_days) ?? "");
  const validUntil = dia && Number.isInteger(dias) && dias > 0 && dias < 3650 ? sumarDias(dia, dias) : null;
  const enviado = instanteAr(p.sent_date);
  const visto = instanteAr(p.viewed);
  let status = ctx.aceptados.has(c.alboomId) ? "ACEPTADO" : visto ? "VISTO" : enviado ? "ENVIADO" : "BORRADOR";
  if ((status === "ENVIADO" || status === "VISTO") && validUntil && validUntil < ctx.hoy) status = "VENCIDO";
  const propuesta = [textoLargo(p.payment_conditions, 4000), textoLargo(p.message, 4000)].filter(Boolean).join("\n\n");
  return {
    accion: "CREAR",
    datos: {
      numero: c.alboomId,
      consultaLeadId: lead,
      clientId,
      status,
      ownerUserId: usuario(ctx.usuarioDe, p.user_id),
      validUntil,
      createdAt: creado,
      sentAt: enviado ?? (status === "ACEPTADO" ? creado : null),
      acceptedAt: status === "ACEPTADO" ? (instanteAr(p.modified) ?? creado) : null,
      terms: textoLargo(p.general_conditions, 20_000),
      paymentProposal: propuesta || null,
    },
    extra: { items, totals },
    huellas: {},
    ...(dudas.length ? { dudas } : {}),
  };
}

// ── Pedidos ─────────────────────────────────────────────────────────────────────

export type CtxPedidos = {
  contactoDe: Map<string, string>;
  leadDe: Map<string, string>;
  presupuestoDe: Map<string, string>;
  productoDe: Map<string, string>;
  usuarioDe: Map<string, string>;
  detalle: Map<string, Record<string, unknown>>;
  /** Ítems de `pedidos_items` por id de pedido. */
  itemsDe: Map<string, { alboomId: string; p: Record<string, unknown> }[]>;
  /** Números de pedido ya usados en FOTOFFICE (para no chocar). */
  numeros: Set<string>;
  /** Presupuestos de FOTOFFICE que ya tienen pedido (uno solo por presupuesto). */
  presupuestosConPedido: Set<string>;
  existentes: Set<string>;
  mapa: Map<string, EntradaMapa>;
};

/** Estado de FOTOFFICE para el de Alboom (ver el plan: 475 sólo es COMPLETADO si el evento ya pasó el corte). */
export function estadoDePedido(estado: string | null, evento: string | null): { status: string; abierto: boolean } {
  if (estado === "474") return { status: "CANCELADO", abierto: false };
  if (estado === "476") return { status: "COMPLETADO", abierto: false };
  if (estado === "475") return { status: evento && evento >= CORTE_FOTOFFICE ? "CONFIRMADO" : "COMPLETADO", abierto: false };
  return { status: "CONFIRMADO", abierto: true };
}

export function traducirPedido(c: Crudo, ctx: CtxPedidos): Decision {
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const p = unir(campos(c.payload), ctx.detalle.get(c.alboomId), "order");
  const idCliente = idAlboom(p.customer_id);
  const clientId = idCliente ? ctx.contactoDe.get(idCliente) : undefined;
  if (!clientId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.contactoSinCargar };
  const dudas: string[] = [];
  let number = c.alboomId;
  if (ctx.numeros.has(number)) {
    number = `ALB-${c.alboomId}`;
    dudas.push(DUDAS_8B2.numeroOcupado);
  }
  const evento = fecha(p.event_date);
  const estado = idAlboom(p.status_id);
  const { status, abierto } = estadoDePedido(estado, evento);
  if (abierto) dudas.push(DUDAS_8B2.pedidoAbierto);
  const sueltos = (ctx.itemsDe.get(c.alboomId) ?? []).map((x) => x.p);
  const filas = sueltos.length > 0 ? sueltos : filasDe(p.order_items, p.items);
  const items = itemsDeAlboom(filas, ctx.productoDe, p.other_expenses);
  const totalAlboom = num(p.grand_total) ?? num(p.total);
  const totals = totalesYDuda(items, descuentoDeAlboom(p), p.total, dudas);
  const idPresupuesto = idAlboom(p.quote_id);
  let presupuestoId = idPresupuesto ? (ctx.presupuestoDe.get(idPresupuesto) ?? null) : null;
  if (presupuestoId && ctx.presupuestosConPedido.has(presupuestoId)) {
    presupuestoId = null;
    dudas.push(DUDAS_8B2.presupuestoUsado);
  }
  const idLead = idAlboom(p.lead_id);
  const c1 = idAlboom(p.contractor1_id);
  const c2 = idAlboom(p.contractor2_id);
  const contratante1 = (c1 ? ctx.contactoDe.get(c1) : undefined) ?? null;
  const contratante2 = (c2 ? ctx.contactoDe.get(c2) : undefined) ?? null;
  const nota = notaDeAlboom(`Datos de Alboom del pedido ${number}`, [
    ...renglon("Estado en Alboom", estado ? (ESTADO_PEDIDO[estado] ?? estado) : null),
    ...renglon("Descripción", p.description, 2000),
    ...renglon("Memo", p.memo, 2000),
    ...renglon("Etiquetas", p.tags),
    ...renglon("Prioridad", p.priority_name),
    ...renglon("Clase", p.class),
    ...renglon("Referente", idAlboom(p.referrer_id) ? `contacto ${idAlboom(p.referrer_id)} de Alboom` : null),
    ...renglon("Vendedor", [texto(p.user_name), texto(p.user_lastname)].filter(Boolean).join(" ")),
    ...renglon("Fecha de finalización", fecha(p.completed_date)),
    ...renglon("IVA", num(p.vat) ? importe(p.vat) : null),
    ...renglon("Costo total en Alboom", num(p.cost) ? importe(p.cost) : null),
    ...renglon("Lugar del evento", [texto(p.place_event), texto(p.place_reception), texto(p.city_event)].filter(Boolean).join(" · ")),
    ...renglon("Novios", [texto(p.bride_name), texto(p.groom_name)].filter(Boolean).join(" y ")),
    ...["extra1", "extra2", "extra3", "extra4", "extra_date1", "extra_date2"].flatMap((k) => renglon(`Campo ${k}`, p[k])),
  ]);
  const datos: Campos = {
    number,
    clientId,
    consultaLeadId: idLead ? (ctx.leadDe.get(idLead) ?? null) : null,
    presupuestoId,
    status,
    cancelReason: status === "CANCELADO" ? "Cancelado en Alboom" : null,
    totalArs: Math.max(0, totalAlboom ?? totals.total).toFixed(2),
    eventDate: evento,
    eventLabel: texto(p.name, 200),
    ownerUserId: usuario(ctx.usuarioDe, p.user_id),
    createdAt: instanteAr(p.add_date) ?? instanteAr(p.created),
    contratante1,
    contratante2: contratante2 && contratante2 !== contratante1 ? contratante2 : null,
    nota,
  };
  return { accion: "CREAR", datos, extra: { items, totals }, huellas: {}, ...(dudas.length ? { dudas } : {}) };
}

export function registrarPedido(ctx: CtxPedidos, d: Decision, _targetId: string): void {
  if (d.accion !== "CREAR" || !d.datos) return;
  ctx.numeros.add(String(d.datos.number));
  if (typeof d.datos.presupuestoId === "string") ctx.presupuestosConPedido.add(d.datos.presupuestoId);
}

// ── Cuotas del plan ─────────────────────────────────────────────────────────────

export type CtxCuotas = {
  pedidoDe: Map<string, string>;
  /** Id de Alboom del método de pago → nombre (`metodos_pago`). */
  metodoDe: Map<string, string>;
  /** Posición (1..n, por vencimiento) de cada cuota dentro de su pedido. */
  posicion: Map<string, number>;
  existentes: Set<string>;
  mapa: Map<string, EntradaMapa>;
};

/** Posición de cada cuota de Alboom en su pedido: por vencimiento y, a igual vencimiento, por id. */
export function posicionesDeCuotas(crudos: { alboomId: string; payload: unknown }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const [, cuotas] of porPadreConFecha(crudos)) cuotas.forEach((x, i) => out.set(x.alboomId, i + 1));
  return out;
}

function porPadreConFecha(crudos: { alboomId: string; payload: unknown }[]) {
  const m = new Map<string, { alboomId: string; dia: string }[]>();
  for (const c of crudos) {
    const padre = padreDe(c.alboomId);
    if (!padre) continue;
    const p = campos(c.payload);
    m.set(padre, [...(m.get(padre) ?? []), { alboomId: c.alboomId, dia: fecha(p.due_date) ?? "9999-12-31" }]);
  }
  for (const v of m.values()) v.sort((a, b) => (a.dia === b.dia ? (a.alboomId < b.alboomId ? -1 : 1) : a.dia < b.dia ? -1 : 1));
  return m;
}

export function metodoDeCuota(p: Record<string, unknown>, metodoDe: Map<string, string>): { medio: Medio; conocido: boolean } {
  const idMetodo = idAlboom(p.category_id ?? p.document_type_id);
  return medioDePago(texto(p.category_name ?? p.document_type_name) ?? (idMetodo ? metodoDe.get(idMetodo) : null));
}

export function traducirCuota(c: Crudo, ctx: CtxCuotas): Decision {
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const p = campos(c.payload);
  if (siNo(p.deleted)) return { accion: "OMITIR", motivo: "Cuota borrada en Alboom" };
  const idPedido = padreDe(c.alboomId) ?? idAlboom(p.order_id);
  const pedidoId = idPedido ? ctx.pedidoDe.get(idPedido) : undefined;
  if (!pedidoId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.pedidoSinCargar };
  const monto = importe(p.value ?? p.amount);
  if (monto === null || Number(monto) <= 0) return { accion: "OMITIR", motivo: MOTIVOS_8B2.importeCero };
  const dueDate = fecha(p.due_date);
  if (!dueDate) return { accion: "OMITIR", motivo: MOTIVOS_8B2.sinFecha };
  const m = metodoDeCuota(p, ctx.metodoDe);
  return {
    accion: "CREAR",
    datos: { pedidoId, position: ctx.posicion.get(c.alboomId) ?? 1, dueDate, amountArs: monto, suggestedMethod: m.conocido ? m.medio : null },
    huellas: {},
  };
}

// ── Costos del pedido → cuentas a pagar ─────────────────────────────────────────

/** Un asiento de Alboom (cuenta a pagar o pago) de un pedido, para emparejar con sus costos. */
export type AsientoPedido = { alboomId: string; monto: string; fecha: string | null; medio: string | null };

/** Asientos con pedido, agrupados por id de pedido (`account_trans.order_id`). */
export function asientosPorPedido(crudos: { alboomId: string; payload: unknown }[]): Map<string, AsientoPedido[]> {
  const m = new Map<string, AsientoPedido[]>();
  for (const c of crudos) {
    const p = campos(c.payload);
    const pedido = idAlboom(p.order_id);
    const monto = importeConSigno(p.amount ?? p.total);
    if (!pedido || !monto) continue;
    m.set(pedido, [...(m.get(pedido) ?? []), { alboomId: c.alboomId, monto: monto.valor, fecha: instanteAr(p.add_date) ?? instanteAr(p.cleared_date), medio: texto(p.document_type_name) }]);
  }
  return m;
}

/** Importe de un costo de pedido (`total` si es > 0; si no, `cost`), o `null` si es cero. */
export function montoDeCosto(p: Record<string, unknown>): string | null {
  const t = importe(p.total);
  const m = t !== null && Number(t) > 0 ? t : importe(p.cost);
  return m !== null && Number(m) > 0 ? m : null;
}

export type Emparejado = { pago?: AsientoPedido; pendiente?: AsientoPedido };

/**
 * Qué pago y qué cuenta a pagar de Alboom corresponden a cada costo de pedido: mismo pedido y mismo importe, en orden
 * de ids, cada asiento a un solo costo. Determinístico (sale sólo de los crudos), así la simulación y la carga, y las
 * partes de pagos y cuentas a pagar, ven lo mismo sin depender de lo ya escrito.
 */
export function emparejarCostos(
  costos: { alboomId: string; payload: unknown }[],
  pagosPorPedido: Map<string, AsientoPedido[]>,
  pendientesPorPedido: Map<string, AsientoPedido[]>,
  pedidoCargado: (idPedido: string) => boolean,
): Map<string, Emparejado> {
  const usados = new Set<string>();
  const out = new Map<string, Emparejado>();
  const libre = (lista: AsientoPedido[] | undefined, monto: string) => {
    const a = (lista ?? []).find((x) => x.monto === monto && !usados.has(x.alboomId));
    if (a) usados.add(a.alboomId);
    return a;
  };
  for (const c of [...costos].sort((a, b) => (a.alboomId < b.alboomId ? -1 : 1))) {
    const p = campos(c.payload);
    const idPedido = padreDe(c.alboomId) ?? idAlboom(p.target_id);
    const monto = montoDeCosto(p);
    if (!idPedido || !monto || !pedidoCargado(idPedido)) continue;
    const e: Emparejado = {};
    if (siNo(p.cleared) === true) e.pago = libre(pagosPorPedido.get(idPedido), monto);
    e.pendiente = libre(pendientesPorPedido.get(idPedido), monto);
    out.set(c.alboomId, e);
  }
  return out;
}

/** Ids de Alboom de los pagos y cuentas a pagar que ya representa algún costo de pedido. */
export function consumidosPorCostos(e: Map<string, Emparejado>): Set<string> {
  const s = new Set<string>();
  for (const x of e.values()) {
    if (x.pago) s.add(x.pago.alboomId);
    if (x.pendiente) s.add(x.pendiente.alboomId);
  }
  return s;
}

export type CtxCostosPedido = {
  pedidoDe: Map<string, string>;
  contactoDe: Map<string, string>;
  /** Nombre normalizado del rubro de egreso de Caja → id (sólo se busca; nunca se crea). */
  rubroPorNombre: Map<string, string>;
  /** Ver `emparejarCostos`. */
  emparejado: Map<string, Emparejado>;
  existentes: Set<string>;
  mapa: Map<string, EntradaMapa>;
};

export function traducirCostoPedido(c: Crudo, ctx: CtxCostosPedido): Decision {
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const p = campos(c.payload);
  const idPedido = padreDe(c.alboomId) ?? idAlboom(p.target_id);
  const pedidoId = idPedido ? ctx.pedidoDe.get(idPedido) : undefined;
  if (!idPedido || !pedidoId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.pedidoSinCargar };
  const monto = montoDeCosto(p);
  if (monto === null) return { accion: "OMITIR", motivo: MOTIVOS_8B2.importeCero };
  const dudas: string[] = [];
  const idProveedor = idAlboom(p.vendor_id);
  const supplierClientId = idProveedor ? (ctx.contactoDe.get(idProveedor) ?? null) : null;
  if (idProveedor && !supplierClientId) dudas.push(DUDAS.proveedorSinCargar);
  const rubro = texto(p.account_cogs_name, 120);
  const e = ctx.emparejado.get(c.alboomId) ?? {};
  let paidAt: string | null = null;
  let paidMethod: string | null = null;
  if (siNo(p.cleared) === true) {
    paidAt = e.pago?.fecha ?? instanteAr(p.due_date) ?? instanteAr(`${CORTE_FOTOFFICE} 12:00:00`);
    if (!e.pago?.fecha) dudas.push(DUDAS_8B2.pagoSinFecha);
    paidMethod = medioDePago(e.pago?.medio).medio;
  }
  return {
    accion: "CREAR",
    datos: {
      pedidoId,
      supplierClientId,
      concept: (texto(p.name, 200) ?? rubro ?? "Costo").slice(0, 200),
      amountArs: monto,
      dueDate: fecha(p.due_date),
      costCategoryId: rubro ? (ctx.rubroPorNombre.get(clave(rubro)) ?? null) : null,
      paidAt,
      paidMethod,
    },
    huellas: {},
    ...(dudas.length ? { dudas } : {}),
  };
}
