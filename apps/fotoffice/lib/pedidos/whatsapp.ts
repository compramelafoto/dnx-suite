import { createHash } from "node:crypto";
import { sumarDias } from "./plan-cuotas";

/**
 * PURO. Lo que necesita el bot de WhatsApp para vender cualquier producto del catálogo como un
 * pedido común (digitalización, pendrives, cuadros…): elegir el producto por su nombre, la seña
 * del 50 % como primera cuota y la clave del alta (el mismo pedido repetido no se crea dos veces).
 */

export const SENA_PORCENTAJE = 50;
/** El saldo vence a la semana: se paga al retirar o desde el mismo enlace. */
export const DIAS_SALDO = 7;

export type ProductoDelBot = {
  id: string;
  name: string;
  priceMinor: number;
  variants: { id: string; name: string; priceMinor: number }[];
};

export type Eleccion =
  | { ok: true; productId: string; variantId: string | null; nombre: string; precio: number }
  | { ok: false; motivo: "NO_ESTA" | "AMBIGUO" | "SIN_PRECIO" | "VARIANTE"; opciones: string[] };

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** El producto por nombre: primero el nombre exacto; si no, el único que lo contiene. */
export function elegirProducto(productos: readonly ProductoDelBot[], nombre: string, variante?: string | null): Eleccion {
  const n = normal(nombre);
  const exacto = productos.filter((p) => normal(p.name) === n);
  const candidatos = exacto.length > 0 ? exacto : productos.filter((p) => normal(p.name).includes(n));
  if (candidatos.length === 0) return { ok: false, motivo: "NO_ESTA", opciones: [] };
  if (candidatos.length > 1) return { ok: false, motivo: "AMBIGUO", opciones: candidatos.map((p) => p.name) };
  const p = candidatos[0];
  const conPrecio = p.variants.filter((v) => v.priceMinor > 0);
  if (conPrecio.length > 0) {
    const v = variante ? conPrecio.find((x) => normal(x.name) === normal(variante)) : conPrecio.length === 1 ? conPrecio[0] : undefined;
    if (!v) return { ok: false, motivo: "VARIANTE", opciones: conPrecio.map((x) => `${p.name} ${x.name}`) };
    return { ok: true, productId: p.id, variantId: v.id, nombre: `${p.name} ${v.name}`, precio: v.priceMinor / 100 };
  }
  if (p.priceMinor <= 0) return { ok: false, motivo: "SIN_PRECIO", opciones: [p.name] };
  return { ok: true, productId: p.id, variantId: null, nombre: p.name, precio: p.priceMinor / 100 };
}

/** La seña (redondeada a pesos enteros) y el saldo de un total en pesos. */
export function senaDe(total: number): { sena: number; saldo: number } {
  const sena = Math.min(total, Math.round((total * SENA_PORCENTAJE) / 100));
  return { sena, saldo: Math.round((total - sena) * 100) / 100 };
}

/** El plan del pedido: con seña, dos cuotas (hoy la seña, el saldo a la semana); al contado, una hoy. */
export function planDelBot(total: number, pago: "SENA" | "TOTAL", hoy: string): { dueDate: string; amountArs: number }[] {
  if (total <= 0) return [];
  const { sena, saldo } = senaDe(total);
  if (pago === "TOTAL" || saldo <= 0 || sena <= 0) return [{ dueDate: hoy, amountArs: total }];
  return [
    { dueDate: hoy, amountArs: sena },
    { dueDate: sumarDias(hoy, DIAS_SALDO), amountArs: saldo },
  ];
}

/** Prefijo de las claves de alta de los pedidos de un chat (para encontrar el anterior). */
export function prefijoDelChat(chatId: string): string {
  return `wa-${chatId}-`;
}

/** La clave del alta: el chat más lo que se pide. El mismo pedido repetido devuelve el que ya existe. */
export function claveDelAlta(chatId: string, lineas: readonly { productId: string; variantId: string | null; cantidad: number }[], pago: string): string {
  const firma = JSON.stringify([pago, ...lineas.map((l) => [l.productId, l.variantId, l.cantidad])]);
  return `${prefijoDelChat(chatId)}${createHash("sha256").update(firma).digest("hex").slice(0, 12)}`.slice(0, 90);
}
