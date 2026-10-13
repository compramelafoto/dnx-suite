import { DUDAS, MOTIVOS, actualizarOIgual, huellasDe, porMapa } from "../campos";
import { campos, clave, entero, idAlboom, importe, siNo, texto, textoLargo } from "../normalizar";
import type { Campos, Crudo, Decision, EntradaMapa } from "../tipos";

/**
 * Productos, combos y costos de Alboom → catálogo de FOTOFFICE (Etapa 2/3).
 *
 * - Producto (`/products/all`, doc 02 §17.6: `id, code, name, description, category_id, category_name, pack,
 *   price, min_price, active, list, cost`) → `Product` + `FotofficeProductoCatalogo` (lista de precios, combo).
 *   Se empareja por nombre (y si no, por código) con los existentes; si no, se crea. Sin stock (Alboom no lo
 *   lleva). La categoría se busca por nombre en las categorías de producto y, si falta, se crea.
 * - Ítem de combo (`/products/pack/:id`, §17.7: `pack_id, product_id, qty, price, discount`) → `FotofficeComboItem`.
 *   FOTOFFICE no guarda precio ni descuento por ítem: si venían, es una duda.
 * - Costo (`/products/costs/:id`, §17.5: `vendor_id, name, cost, cost_due_days, account_cogs_name`) →
 *   `FotofficeCostoPlantilla` (importe fijo; el proveedor, si se cargó como contacto).
 */

export const TIPO_PRODUCTO = "PRODUCT";
export const TIPO_ITEM_COMBO = "COMBO_ITEM";
export const TIPO_COSTO = "COSTO_PLANTILLA";

export const MAX_NOMBRE_PRODUCTO = 200;
export const MAX_IMPORTE = 9_999_999_999.99;
export const MAX_CONCEPTO = 120;
export const MAX_DIAS = 3650;
export const MAX_CANTIDAD = 1000;

/** Categorías de Alboom que son servicios (lo demás se carga como producto). Ajustable con los datos reales. */
const CATEGORIAS_SERVICIO = new Set(["evento", "sesion", "otro"]);

export type ProductoExistente = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  priceArs: string;
  costArs: string | null;
  isActive: boolean;
  categoria: string | null;
  inPriceList: boolean;
  isCombo: boolean;
};

export type CtxProductos = {
  productos: ProductoExistente[];
  mapa: Map<string, EntradaMapa>;
};

function importeValido(v: unknown): string | null {
  const i = importe(v);
  return i !== null && Number(i) <= MAX_IMPORTE ? i : null;
}

function camposDeProducto(c: Crudo, ctx: CtxProductos, targetId: string | null): { nuevos: Campos; dudas: string[] } {
  const p = campos(c.payload);
  const dudas: string[] = [];
  const price = importeValido(p.price);
  if (price === null) dudas.push(DUDAS.precioFaltante);
  let sku = texto(p.code, 60);
  if (sku && ctx.productos.some((x) => x.sku === sku && x.id !== targetId)) {
    sku = null;
    dudas.push(DUDAS.codigoRepetido);
  }
  const nuevos: Campos = {
    sku,
    description: textoLargo(p.description, 2000),
    priceArs: price,
    costArs: importeValido(p.cost),
    isActive: siNo(p.active) ?? true,
    categoria: texto(p.category_name, 80),
    inPriceList: siNo(p.list) ?? false,
    isCombo: siNo(p.pack) ?? false,
  };
  return { nuevos, dudas };
}

export function actualDeProducto(x: ProductoExistente): Campos {
  return {
    sku: x.sku,
    description: x.description,
    priceArs: x.priceArs,
    costArs: x.costArs,
    isActive: x.isActive,
    categoria: x.categoria,
    inPriceList: x.inPriceList,
    isCombo: x.isCombo,
  };
}

export function traducirProducto(c: Crudo, ctx: CtxProductos): Decision {
  const mapa = ctx.mapa.get(c.alboomId);
  const ya = porMapa(c, mapa, (id) => ctx.productos.some((x) => x.id === id));
  if (ya) return ya;
  const p = campos(c.payload);
  const nombreCompleto = texto(p.name, 1000);
  if (!nombreCompleto) return { accion: "OMITIR", motivo: MOTIVOS.sinNombre };
  const name = nombreCompleto.slice(0, MAX_NOMBRE_PRODUCTO).trim();
  const codigo = texto(p.code, 60);
  const existente = mapa
    ? ctx.productos.find((x) => x.id === mapa.targetId)
    : (ctx.productos.find((x) => clave(x.name) === clave(name)) ?? (codigo ? ctx.productos.find((x) => x.sku === codigo) : undefined));
  const { nuevos, dudas } = camposDeProducto(c, ctx, existente?.id ?? null);
  if (nombreCompleto.length > MAX_NOMBRE_PRODUCTO) dudas.push(DUDAS.nombreLargo);
  const extraDudas = dudas.length ? { dudas } : {};
  if (existente) return actualizarOIgual(existente.id, nuevos, actualDeProducto(existente), mapa, extraDudas);
  const categoria = typeof nuevos.categoria === "string" ? nuevos.categoria : null;
  return {
    accion: "CREAR",
    datos: {
      name,
      ...nuevos,
      priceArs: nuevos.priceArs ?? "0.00",
      kind: categoria && CATEGORIAS_SERVICIO.has(clave(categoria)) ? "SERVICIO" : "PRODUCTO",
    },
    huellas: huellasDe(nuevos),
    ...extraDudas,
  };
}

export function registrarProducto(ctx: CtxProductos, d: Decision, targetId: string): void {
  if (d.accion !== "CREAR" || !d.datos) return;
  const v = d.datos;
  ctx.productos.push({
    id: targetId,
    name: String(v.name),
    sku: (v.sku as string | null) ?? null,
    description: (v.description as string | null) ?? null,
    priceArs: String(v.priceArs),
    costArs: (v.costArs as string | null) ?? null,
    isActive: v.isActive !== false,
    categoria: (v.categoria as string | null) ?? null,
    inPriceList: v.inPriceList === true,
    isCombo: v.isCombo === true,
  });
}

// ── Combos ──────────────────────────────────────────────────────────────────

export type ItemComboExistente = { id: string; comboProductId: string; componentProductId: string; quantity: number };

export type CtxCombos = {
  /** Id de producto de Alboom → producto de FOTOFFICE (cargado, o simulado). */
  productoDe: Map<string, string>;
  items: ItemComboExistente[];
  mapa: Map<string, EntradaMapa>;
};

export function traducirItemCombo(c: Crudo, ctx: CtxCombos): Decision {
  const mapa = ctx.mapa.get(c.alboomId);
  const ya = porMapa(c, mapa, (id) => ctx.items.some((x) => x.id === id));
  if (ya) return ya;
  const p = campos(c.payload);
  const idCombo = idAlboom(p.pack_id) ?? idAlboom(c.alboomId.split("/")[0]);
  const idComponente = idAlboom(p.product_id);
  if (!idCombo || !idComponente) return { accion: "OMITIR", motivo: MOTIVOS.formaDesconocida };
  const comboProductId = ctx.productoDe.get(idCombo);
  if (!comboProductId) return { accion: "OMITIR", motivo: MOTIVOS.productoSinCargar };
  const componentProductId = ctx.productoDe.get(idComponente);
  if (!componentProductId) return { accion: "OMITIR", motivo: MOTIVOS.componenteSinCargar };
  if (componentProductId === comboProductId) return { accion: "OMITIR", motivo: MOTIVOS.componenteEsCombo };
  const cantidad = Math.min(MAX_CANTIDAD, Math.max(1, entero(p.qty) ?? 1));
  const dudas = (importe(p.discount) ?? "0.00") !== "0.00" ? [DUDAS.descuentoEnCombo] : [];
  const nuevos: Campos = { quantity: cantidad };
  const extraDudas = dudas.length ? { dudas } : {};
  const existente = mapa
    ? ctx.items.find((x) => x.id === mapa.targetId)
    : ctx.items.find((x) => x.comboProductId === comboProductId && x.componentProductId === componentProductId);
  if (existente) return actualizarOIgual(existente.id, nuevos, { quantity: existente.quantity }, mapa, extraDudas);
  return {
    accion: "CREAR",
    datos: { comboProductId, componentProductId, quantity: cantidad, order: ctx.items.filter((x) => x.comboProductId === comboProductId).length },
    huellas: huellasDe(nuevos),
    ...extraDudas,
  };
}

export function registrarItemCombo(ctx: CtxCombos, d: Decision, targetId: string): void {
  if (d.accion !== "CREAR" || !d.datos) return;
  ctx.items.push({
    id: targetId,
    comboProductId: String(d.datos.comboProductId),
    componentProductId: String(d.datos.componentProductId),
    quantity: Number(d.datos.quantity),
  });
}

// ── Costos ──────────────────────────────────────────────────────────────────

export type CostoExistente = {
  id: string;
  productId: string;
  concept: string;
  amountArs: string;
  daysFromEvent: number;
  supplierClientId: string | null;
};

export type CtxCostos = {
  productoDe: Map<string, string>;
  /** Id de contacto de Alboom → cliente de FOTOFFICE (cargado, o simulado). */
  contactoDe: Map<string, string>;
  costos: CostoExistente[];
  mapa: Map<string, EntradaMapa>;
};

export function traducirCosto(c: Crudo, ctx: CtxCostos): Decision {
  const mapa = ctx.mapa.get(c.alboomId);
  const ya = porMapa(c, mapa, (id) => ctx.costos.some((x) => x.id === id));
  if (ya) return ya;
  const p = campos(c.payload);
  const idProducto = idAlboom(c.alboomId.split("/")[0]) ?? idAlboom(p.target_id);
  const productId = idProducto ? ctx.productoDe.get(idProducto) : undefined;
  if (!productId) return { accion: "OMITIR", motivo: MOTIVOS.productoSinCargar };
  const dudas: string[] = [];
  const amount = importeValido(p.cost);
  if (amount === null) dudas.push(DUDAS.costoSinImporte);
  const idProveedor = idAlboom(p.vendor_id);
  const supplierClientId = idProveedor ? (ctx.contactoDe.get(idProveedor) ?? null) : null;
  if (idProveedor && !supplierClientId) dudas.push(DUDAS.proveedorSinCargar);
  const dias = entero(p.cost_due_days);
  const concept = (texto(p.name, 1000) ?? texto(p.account_cogs_name, 1000) ?? "Costo").slice(0, MAX_CONCEPTO).trim();
  const nuevos: Campos = {
    concept,
    amountArs: amount,
    daysFromEvent: dias === null ? null : Math.max(-MAX_DIAS, Math.min(MAX_DIAS, dias)),
    supplierClientId,
  };
  const extraDudas = dudas.length ? { dudas } : {};
  const existente = mapa
    ? ctx.costos.find((x) => x.id === mapa.targetId)
    : ctx.costos.find((x) => x.productId === productId && clave(x.concept) === clave(concept));
  if (existente) {
    const actual: Campos = {
      concept: existente.concept,
      amountArs: existente.amountArs,
      daysFromEvent: existente.daysFromEvent,
      supplierClientId: existente.supplierClientId,
    };
    return actualizarOIgual(existente.id, nuevos, actual, mapa, extraDudas);
  }
  return {
    accion: "CREAR",
    datos: {
      productId,
      ...nuevos,
      amountArs: amount ?? "0.00",
      daysFromEvent: (nuevos.daysFromEvent as number | null) ?? 0,
      order: ctx.costos.filter((x) => x.productId === productId).length,
    },
    huellas: huellasDe(nuevos),
    ...extraDudas,
  };
}

export function registrarCosto(ctx: CtxCostos, d: Decision, targetId: string): void {
  if (d.accion !== "CREAR" || !d.datos) return;
  ctx.costos.push({
    id: targetId,
    productId: String(d.datos.productId),
    concept: String(d.datos.concept),
    amountArs: String(d.datos.amountArs),
    daysFromEvent: Number(d.datos.daysFromEvent),
    supplierClientId: (d.datos.supplierClientId as string | null) ?? null,
  });
}
