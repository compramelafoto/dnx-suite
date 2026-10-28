/**
 * Productos que otra pantalla manda a cobrar en el Mostrador, por la dirección:
 * `/ventas?agregar=SKU*cantidad,SKU*cantidad`. Lo usa el diseñador de polaroids. Módulo PURO.
 *
 * Por SKU y no por id: es lo que arma la regla de precios (`lib/polaroid/productos.ts`) y lo que
 * se lee en el catálogo. El Mostrador busca cada SKU entre sus productos; el precio lo pone
 * siempre el catálogo, nunca la dirección.
 */

export type AgregarAlAbrir = { sku: string; cantidad: number };

const MAX_RENGLONES = 20;
const MAX_CANTIDAD = 9999;

export function leerAgregarAlAbrir(valor: string | string[] | undefined): AgregarAlAbrir[] {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (!texto) return [];
  const out: AgregarAlAbrir[] = [];
  for (const parte of texto.split(",").slice(0, MAX_RENGLONES)) {
    const [sku, cant] = parte.split("*");
    const cantidad = Number(cant);
    if (!sku || !/^[A-Za-z0-9._-]{1,64}$/.test(sku)) continue;
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD) continue;
    out.push({ sku, cantidad });
  }
  return out;
}

export function enlaceAgregarAlAbrir(renglones: AgregarAlAbrir[]): string {
  return `/ventas?agregar=${renglones.map((r) => `${r.sku}*${r.cantidad}`).join(",")}`;
}
