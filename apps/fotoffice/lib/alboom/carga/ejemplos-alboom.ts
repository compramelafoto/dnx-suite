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
