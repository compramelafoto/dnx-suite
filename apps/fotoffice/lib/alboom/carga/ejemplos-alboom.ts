import { huella } from "../huella";
import type { Crudo, EntradaMapa } from "./tipos";

/**
 * Crudos de ejemplo SÓLO PARA PRUEBAS, armados con las formas de `docs/alboom/01`, `02`, `05` y `09` y con el
 * fixture real de una oportunidad del Asistente de ventas (ids y números como texto, fechas "aaaa-mm-dd hh:mm:ss").
 * Datos inventados.
 */

export function crudo(entity: string, alboomId: string, payload: unknown): Crudo {
  return { entity, alboomId, payload, hash: huella(payload) };
}

export function mapaDe(c: Crudo, targetType: string, targetId: string, fieldHashes: Record<string, string> = {}): EntradaMapa {
  return { entity: c.entity, alboomId: c.alboomId, targetType, targetId, payloadHash: c.hash, fieldHashes };
}

export const USUARIO = { id: "1", name: "Ana", lastname: "Gómez", email: " Ana@Estudio.test ", role: "admin", active: "1" };

/** Contacto con todos los campos de doc 01 §13.4 (como texto, igual que el resto de Alboom). */
export const CONTACTO = {
  id: "7001",
  type: "2",
  type_name: "Cliente",
  is_company: "0",
  company: "",
  name: "Lucía",
  lastname: "Fernández",
  email: " Lucia.Fernandez@Correo.test ",
  email2: "",
  phone: "",
  cellular: "341 15 555-1234",
  birthday: "1990-05-17",
  gender: "female",
  rg: "30.123.456",
  cpf: "",
  site_url: "",
  memo: "Prefiere WhatsApp",
  class_id: "0",
  tags: "VIP, Boda 2026",
  zipcode: "2132",
  country: "Argentina",
  address1: "San José 1672",
  address2: "Local 5",
  city: "Funes",
  state: "Santa Fe",
  extra1: "",
  created: "2024-03-01 10:00:00",
  modified: "2026-09-14 21:37:24",
};

export const PRODUCTO = {
  id: "55",
  code: "EV-01",
  name: "Cobertura fotográfica de evento",
  description: "Hasta 6 horas de cobertura",
  category_id: "3",
  category_name: "Evento",
  pack: "0",
  price: "150000.00",
  min_price: "0.00",
  active: "1",
  list: "1",
  cost: "20000.00",
};

export const COMBO = { ...PRODUCTO, id: "60", code: "PK-15", name: "Paquete 15 años", pack: "1", price: "280000.00", cost: "0.00" };
export const ITEM_COMBO = { pack_id: "60", product_id: "55", code: "EV-01", name: "Cobertura fotográfica de evento", price: "150000.00", discount: "0", qty: "2", total: "300000.00" };
export const COSTO = { id: "9", type: "products", target_id: "55", vendor_id: "7001", name: "Segundo fotógrafo", cost: "20000.00", cost_due_days: "0", account_cogs_id: "41", account_cogs_name: "Fotógrafos Freelancers" };

export const CATEGORIA_15 = { id: "12", name: "15 anos", type: "lead_type", subtype: "Evento", active: "1" };
export const EMBUDO = { id: "1611", name: "Embudo de Ventas DNX 2022" };
export const ETAPA_1 = { id: "9001", type_id: "1611", stage: "1", name: "Recepción de la oportunidnad", offset_days: "2", tasks: "" };
export const ORIGEN = { name: "Recomendado por un amigo/a", posicion: 1 };
export const ETIQUETA = { tag: "VIP", type: "contacts" };

// ── 8B-2 (formas de los docs 01 §13, 02 §17, 03 y 04 §21; las marcadas "supuesta" no están confirmadas) ──

/** Oportunidad (doc 01 §13.1): abierta, en la etapa 1 del embudo 1611, evento a futuro. */
export const OPORTUNIDAD = {
  id: "3001",
  name: "Boda Lucía y Martín",
  customer_id: "7001",
  referrer_id: "",
  category_id: "12",
  lead_origin: "Instagram",
  description: "Nos casamos en marzo",
  amount: "350000.00",
  status_id: "421",
  priority_name: "Alta",
  pipeline_id: "1611",
  stage_id: "1",
  stage_name: "Recepción de la oportunidnad",
  due_date: "2026-10-30",
  completed_date: "",
  event_date: "2027-03-14 18:30:00",
  guests: "150",
  bride_name: "Lucía",
  groom_name: "Martín",
  place_event: "Estancia La Paz",
  place_reception: "",
  city_event: "Funes",
  user_id: "1",
  tags: "Web",
  created: "2026-09-01 10:15:00",
  modified: "2026-09-20 12:00:00",
};

/** Historial de etapas (doc 01 §13.2). */
export const HISTORIAL = { created: "2026-09-01 10:15:00", user_id: "1", user_name: "Ana", stage_id: "1", stage_name: "Recepción", due_date: "2026-09-03", note: "Entró por Instagram" };
/** Nota (doc 01 §13.5, supuesta la paginación). */
export const NOTA = { id: "501", user_id: "1", type: "leads", target_id: "3001", customer_id: "7001", action: "Presupuesto", text: "<p>Le mandé el presupuesto</p>", created: "2026-09-02 09:00:00" };
/** Actividad (doc 01 §13.5). */
export const ACTIVIDAD = { user_id: "1", customer_id: "7001", target_id: "3001", type: "leads", text: "Ana cambió la etapa", link: "", created: "2026-09-02 09:05:00" };
/** Correo (doc 01 §13.5, supuesta). */
export const CORREO = { id: "801", message_type: "mail", to_mail: "lucia@correo.test", subject: "Presupuesto", body: "<p>Hola Lucía</p>", customer_id: "7001", created: "2026-09-02 09:10:00" };

/** Presupuesto (doc 02 §17.1) y su detalle con ítems (§17.2). */
export const PRESUPUESTO = { id: "900", lead_id: "3001", customer_id: "7001", user_id: "1", created: "2026-09-02 08:00:00", sent_date: "2026-09-02 09:00:00", viewed: "", valid_thru_days: "15", total: "300000.00", discount: "0", other_expenses: "0", general_conditions: "Seña del 30%", payment_conditions: "3 cuotas" };
export const PRESUPUESTO_DETALLE = { ...PRESUPUESTO, quote_items: [{ product_id: "55", code: "EV-01", name: "Cobertura fotográfica de evento", price: "150000.00", qty: "2", discount: "0", total: "300000.00" }] };

/** Pedido (doc 02 §17.3). */
export const PEDIDO = {
  id: "2025093",
  name: "Boda Lucía y Martín",
  customer_id: "7001",
  lead_id: "3001",
  quote_id: "900",
  status_id: "475",
  add_date: "2026-09-10 11:00:00",
  event_date: "2025-03-14",
  total: "300000.00",
  grand_total: "300000.00",
  discount: "0",
  other_expenses: "0",
  user_id: "1",
  contractor1_id: "7001",
  memo: "Pidió álbum aparte",
};
export const ITEM_PEDIDO = { order_id: "2025093", product_id: "55", code: "EV-01", name: "Cobertura fotográfica de evento", price: "150000.00", qty: "2", discount: "0", total: "300000.00" };
/** Cuotas del plan (doc 02 §17.4). */
export const CUOTA_1 = { id: "41", order_id: "2025093", due_date: "2026-09-10", category_id: "1", category_name: "Efectivo", value: "100000.00", cleared: "1", cleared_date: "2026-09-10" };
export const CUOTA_2 = { id: "42", order_id: "2025093", due_date: "2026-11-10", category_id: "2", category_name: "Transferencia Bancaria", value: "200000.00", cleared: "0" };
/** Costo del pedido (doc 02 §17.5). */
export const COSTO_PEDIDO = { id: "71", type: "orders", target_id: "2025093", vendor_id: "7004", name: "Segundo fotógrafo", cost: "40000.00", total: "40000.00", due_date: "2025-03-20", cleared: "1", account_cogs_name: "Fotógrafos Freelancers" };

/** Asientos (`account_trans`, doc 04 §21; supuestos los campos de las respuestas de paginate_apr/paginate). */
export const COBRO = { id: "6001", add_date: "2026-09-10 12:00:00", amount: "-100000.00", document_type_id: "1", document_type_name: "Efectivo", order_id: "2025093", order_payment_id: "41", customer_id: "7001", category_id: "83", account_id: "1.1.3", cleared: "1", memo: "Seña" };
export const COBRO_SIN_PEDIDO = { id: "6002", add_date: "2026-08-01 10:00:00", amount: "-5000.00", document_type_name: "Efectivo", order_id: "", customer_id: "7001", category_id: "83", account_id: "1.1.3", memo: "Copias sueltas" };
export const CUENTA_COBRAR = { id: "6101", add_date: "2026-09-10", due_date: "2026-11-10", amount: "-200000.00", order_id: "2025093", customer_id: "7001", category_id: "73", account_id: "1.2", cleared: "0" };
export const PAGO = { id: "6201", add_date: "2025-03-21 10:00:00", amount: "40000.00", document_type_name: "Transferencia Bancaria", order_id: "2025093", customer_id: "7004", category_id: "84", account_id: "1.1.3", cleared: "1" };
export const PAGO_SUELTO = { id: "6202", add_date: "2026-07-01 10:00:00", amount: "15000.00", document_type_name: "Efectivo", order_id: "", customer_id: "7004", memo: "Alquiler de luces", category_id: "84" };
export const MOVIMIENTO_BANCO = { id: "6301", add_date: "2026-07-05", amount: "-80000.00", document_type_name: "Transferencia Bancaria", customer_id: "7001", category_id: "72", account_id: "1.1.3", memo: "Depósito", cleared: "1" };
export const BANCO = { id: "3", name: "Caja del estudio", category_id: "1001" };

/** Contrato (doc 03 §3.12) y su detalle con texto y firma (supuesta la forma de `signature`). */
export const CONTRATO = { id: "357", order_id: "2025093", customer_id: "7001", user_id: "1", name: "Contrato de boda", created: "2026-09-11 10:00:00", sent_date: "2026-09-11 10:05:00", viewed: "2026-09-11 18:00:00" };
export const CONTRATO_DETALLE = {
  ...CONTRATO,
  text: "<p>Entre <b>DNX</b> y la parte contratante…</p><p>Cláusula 1</p>",
  signature: { agree: "1", contractor1: "Lucía Fernández", signature1: "data:image/png;base64,AAAA", signed1: "2026-09-12 20:15:00", ip1: "190.0.0.1" },
};

/** Proyecto (doc 03 §5.14), su historial y un participante. */
export const PROYECTO = { id: "1010", name: "Boda Lucía y Martín - Fotos", customer_id: "7001", order_id: "2025093", pipeline_id: "77", stage_id: "2", status_id: "201", event_date: "2025-03-14", due_date: "2025-04-01", final_due_date: "2025-05-01", user_id: "1", description: "Edición y álbum", created: "2026-09-10 11:05:00" };
export const HISTORIAL_PROYECTO = { created: "2026-09-15 10:00:00", user_id: "1", stage_id: "2", stage_name: "Edición", due_date: "2025-04-01", note: "" };
export const PARTICIPANTE = { id: "5", contact_id: "7004", category_id: "8", category_name: "Fotógrafo Secundario", memo: "Llega 17 h" };

/** Cita (doc 03 §6.10) y tarea (doc 03 §5.14). */
export const CITA = { id: "453", title: "Reunión con los novios", start: "2026-11-05 18:00:00", end: "2026-11-05 19:00:00", all_day: "0", status: "Scheduled", event_type_id: "4", location: "Estudio", details: "Traer muestras", user_id: "1", customer_id: "7001", type: "orders", target_id: "2025093", participants_list: ["1"], created: "2026-10-01 10:00:00" };
export const TAREA = { id: "832", user_id: "1", type: "projects", target_id: "1010", title: "Elegir fotos del álbum", due_date: "2026-11-01", completed: "0", created: "2026-10-01 10:00:00" };
