/**
 * Precios de las fotos extra de una galería (etapa 7, Entrega A2). Módulo PURO: sin base ni red, con
 * entradas simples y todos los importes en CENTAVOS ENTEROS (el servidor convierte desde/hacia
 * `Decimal(14,2)` con `arsACentavos` y `centavosAArs`). Los textos son para mostrar tal cual.
 */
import type { ModoVenta } from "./constantes";

export const MODOS_PRECIO = ["POR_FOTO", "PAQUETE"] as const;
export type ModoPrecio = (typeof MODOS_PRECIO)[number];

export const MODOS_DESCUENTO = ["NINGUNO", "UNICO", "PROGRESIVO"] as const;
export type ModoDescuento = (typeof MODOS_DESCUENTO)[number];

export const MAX_REGLAS_DESCUENTO = 4;
export const DESCUENTO_MIN = 1;
export const DESCUENTO_MAX = 90;
export const TAMANO_PAQUETE_MIN = 2;

export type ReglaDescuento = { pct: number; desde: number };

/** Configuración de venta de una galería, con los importes en centavos. */
export type ConfigVenta = {
  saleMode: ModoVenta;
  includedCount: number;
  pricingMode: ModoPrecio | null;
  unitPriceCents: number | null;
  packageSize: number | null;
  packagePriceCents: number | null;
  discountMode: ModoDescuento;
  discountPct: number | null;
  discountRules: unknown;
};

export const MENSAJES_PRECIOS = {
  modoVentaInvalido: "Elegí si la galería es de selección, de selección y venta o sólo de venta.",
  incluidasInvalido: "Las fotos incluidas tienen que ser un número entero de 0 en adelante.",
  ventaSinIncluidas: "En una galería sólo de venta no hay fotos incluidas: todas se cobran.",
  modoPrecioInvalido: "Elegí si el precio es por foto o por paquete.",
  precioFotoInvalido: "Poné el precio por foto: un importe mayor a cero.",
  tamanoPaqueteInvalido: `El paquete tiene que ser de ${TAMANO_PAQUETE_MIN} fotos o más (número entero).`,
  precioPaqueteInvalido: "Poné el precio del paquete: un importe mayor a cero.",
  modoDescuentoInvalido: "Elegí si hay descuento: ninguno, único o progresivo.",
  descuentoPctInvalido: `El descuento tiene que ser un porcentaje entero entre ${DESCUENTO_MIN} y ${DESCUENTO_MAX}.`,
  reglasInvalidas: "Las reglas del descuento progresivo no tienen el formato correcto.",
  reglasVacias: "Cargá al menos una regla para el descuento progresivo.",
  reglasDemasiadas: `Podés cargar hasta ${MAX_REGLAS_DESCUENTO} reglas de descuento.`,
  reglaPctInvalido: `Cada regla tiene que tener un porcentaje entero entre ${DESCUENTO_MIN} y ${DESCUENTO_MAX}.`,
  reglaDesdeInvalido: "Cada regla tiene que empezar desde 2 fotos o más (número entero).",
  reglasRepetidas: "Dos reglas no pueden empezar desde la misma cantidad de fotos.",
  reglasDesordenadas: "Ordená las reglas de menor a mayor cantidad de fotos.",
} as const;

const esEntero = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const esCentavosPositivos = (v: unknown): v is number => esEntero(v) && v > 0;

// --- Dinero --------------------------------------------------------------------------------------------

/** "1234.50" / 1234.5 / Decimal → 123450. Redondea al centavo; devuelve null si no es un número finito. */
export function arsACentavos(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).trim().replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** 123450 → "1234.50" (texto apto para `Decimal(14,2)`). */
export function centavosAArs(centavos: number): string {
  const signo = centavos < 0 ? "-" : "";
  const abs = Math.abs(Math.round(centavos));
  return `${signo}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** 123450 → "$ 1.234,50" para mostrar. */
export function formatearCentavos(centavos: number): string {
  return `$ ${(centavos / 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- Validación ----------------------------------------------------------------------------------------

/** Reglas del descuento progresivo: ≤ 4, pct 1–90 enteros, desde ≥ 2 enteros, distintos y ordenados. */
export function validarReglasDescuento(
  reglas: unknown,
): { ok: true; reglas: ReglaDescuento[] } | { ok: false; error: string } {
  if (!Array.isArray(reglas)) return { ok: false, error: MENSAJES_PRECIOS.reglasInvalidas };
  if (reglas.length === 0) return { ok: false, error: MENSAJES_PRECIOS.reglasVacias };
  if (reglas.length > MAX_REGLAS_DESCUENTO) return { ok: false, error: MENSAJES_PRECIOS.reglasDemasiadas };
  const out: ReglaDescuento[] = [];
  for (const r of reglas) {
    if (typeof r !== "object" || r === null || Array.isArray(r)) return { ok: false, error: MENSAJES_PRECIOS.reglasInvalidas };
    const { pct, desde } = r as Record<string, unknown>;
    if (!esEntero(pct) || pct < DESCUENTO_MIN || pct > DESCUENTO_MAX) return { ok: false, error: MENSAJES_PRECIOS.reglaPctInvalido };
    if (!esEntero(desde) || desde < 2) return { ok: false, error: MENSAJES_PRECIOS.reglaDesdeInvalido };
    out.push({ pct, desde });
  }
  for (let i = 1; i < out.length; i++) {
    if (out[i].desde === out[i - 1].desde) return { ok: false, error: MENSAJES_PRECIOS.reglasRepetidas };
    if (out[i].desde < out[i - 1].desde) return { ok: false, error: MENSAJES_PRECIOS.reglasDesordenadas };
  }
  return { ok: true, reglas: out };
}

export type ResultadoConfigVenta = { ok: true } | { ok: false; errores: string[] };

/**
 * Misma regla que los CHECK del SQL (`FotofficeGaleria_ventaCompleta`, `_descuentoCompleto`, rangos) más la
 * forma de `discountRules`. Con `SELECCION` no se exige precio ni se mira el descuento.
 */
export function validarConfigVenta(c: ConfigVenta): ResultadoConfigVenta {
  const errores: string[] = [];
  if (c.saleMode !== "SELECCION" && c.saleMode !== "SELECCION_Y_VENTA" && c.saleMode !== "VENTA") {
    return { ok: false, errores: [MENSAJES_PRECIOS.modoVentaInvalido] };
  }
  if (!esEntero(c.includedCount) || c.includedCount < 0) errores.push(MENSAJES_PRECIOS.incluidasInvalido);
  else if (c.saleMode === "VENTA" && c.includedCount !== 0) errores.push(MENSAJES_PRECIOS.ventaSinIncluidas);
  if (c.saleMode === "SELECCION") return errores.length ? { ok: false, errores } : { ok: true };

  if (c.pricingMode === "POR_FOTO") {
    if (!esCentavosPositivos(c.unitPriceCents)) errores.push(MENSAJES_PRECIOS.precioFotoInvalido);
  } else if (c.pricingMode === "PAQUETE") {
    if (!esEntero(c.packageSize) || c.packageSize < TAMANO_PAQUETE_MIN) errores.push(MENSAJES_PRECIOS.tamanoPaqueteInvalido);
    if (!esCentavosPositivos(c.packagePriceCents)) errores.push(MENSAJES_PRECIOS.precioPaqueteInvalido);
  } else {
    errores.push(MENSAJES_PRECIOS.modoPrecioInvalido);
  }

  if (c.discountMode === "UNICO") {
    if (!esEntero(c.discountPct) || c.discountPct < DESCUENTO_MIN || c.discountPct > DESCUENTO_MAX) errores.push(MENSAJES_PRECIOS.descuentoPctInvalido);
  } else if (c.discountMode === "PROGRESIVO") {
    const r = validarReglasDescuento(c.discountRules);
    if (!r.ok) errores.push(r.error);
  } else if (c.discountMode !== "NINGUNO") {
    errores.push(MENSAJES_PRECIOS.modoDescuentoInvalido);
  }
  return errores.length ? { ok: false, errores } : { ok: true };
}

// --- Carrito -------------------------------------------------------------------------------------------

export type FotoSeleccionada = {
  fotoId: string;
  /** `FotofficeGaleriaSeleccion.createdAt`. */
  seleccionadaEn: Date;
  /** Id de la fila de selección: desempata cuando dos tienen la misma fecha. Si falta se usa `fotoId`. */
  id?: string;
};

export type ReglaAplicada = { tipo: "UNICO" | "PROGRESIVO"; pct: number; desde: number | null };

export type Carrito = {
  /** Fotos que entran sin costo, en el orden en que se eligieron. */
  incluidas: string[];
  /** Fotos que se cobran, en el orden en que se eligieron. */
  extras: string[];
  /** Fotos ya pagadas en compras anteriores que siguen elegidas (no se cobran de nuevo). */
  yaPagadas: string[];
  /** Por paquete: cantidad de paquetes (⌈extras ÷ tamaño⌉). */
  paquetes: number | null;
  /** Por paquete: cuántas fotos más entran sin costo en el último paquete (0 si está completo o no hay extras). */
  fotosQueFaltanParaPaquete: number | null;
  subtotalCents: number;
  descuentoCents: number;
  totalCents: number;
  reglaAplicada: ReglaAplicada | null;
};

function ordenarPorSeleccion(sel: FotoSeleccionada[]): FotoSeleccionada[] {
  return [...sel].sort((a, b) => {
    const d = a.seleccionadaEn.getTime() - b.seleccionadaEn.getTime();
    if (d !== 0) return d;
    const ia = a.id ?? a.fotoId;
    const ib = b.id ?? b.fotoId;
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  });
}

const CARRITO_VACIO_BASE = { paquetes: null, fotosQueFaltanParaPaquete: null, subtotalCents: 0, descuentoCents: 0, totalCents: 0, reglaAplicada: null } as const;

/**
 * Calcula el carrito de un cliente. Las fotos ya pagadas se sacan primero (no cuentan ni como incluidas ni
 * como extras); de las restantes, las primeras `includedCount` por fecha de selección son incluidas (en
 * `VENTA`, 0) y el resto son extras. Con `SELECCION`, o con una configuración incompleta, no se cobra nada.
 * El descuento progresivo cuenta sólo las extras de ESTA compra (por foto) o las fotos de los paquetes
 * (por paquete). Redondeo al centavo; el descuento nunca es negativo ni supera el subtotal.
 */
export function calcularCarrito(args: {
  config: ConfigVenta;
  seleccion: FotoSeleccionada[];
  pagadas: ReadonlySet<string>;
}): Carrito {
  const { config, pagadas } = args;
  const vistas = new Set<string>();
  const unicas = ordenarPorSeleccion(args.seleccion).filter((s) => (vistas.has(s.fotoId) ? false : (vistas.add(s.fotoId), true)));
  const yaPagadas = unicas.filter((s) => pagadas.has(s.fotoId)).map((s) => s.fotoId);
  const pendientes = unicas.filter((s) => !pagadas.has(s.fotoId));

  const incluidasN = config.saleMode === "VENTA" ? 0 : config.saleMode === "SELECCION" ? pendientes.length : Math.max(0, config.includedCount);
  const incluidas = pendientes.slice(0, incluidasN).map((s) => s.fotoId);
  const hayVenta = config.saleMode !== "SELECCION" && validarConfigVenta({ ...config, includedCount: incluidasN }).ok;
  const extras = hayVenta ? pendientes.slice(incluidasN).map((s) => s.fotoId) : [];
  // Si no hay venta configurada, las que pasan del tope no se cobran: quedan como incluidas.
  const incluidasFinal = hayVenta ? incluidas : pendientes.map((s) => s.fotoId);

  if (!hayVenta || extras.length === 0) {
    return { incluidas: incluidasFinal, extras, yaPagadas, ...CARRITO_VACIO_BASE };
  }

  let subtotal: number;
  let paquetes: number | null = null;
  let faltan: number | null = null;
  let fotosParaUmbral = extras.length;
  if (config.pricingMode === "PAQUETE") {
    const tam = config.packageSize as number;
    paquetes = Math.ceil(extras.length / tam);
    faltan = paquetes * tam - extras.length;
    subtotal = paquetes * (config.packagePriceCents as number);
    fotosParaUmbral = paquetes * tam;
  } else {
    subtotal = extras.length * (config.unitPriceCents as number);
  }

  let pct = 0;
  let regla: ReglaAplicada | null = null;
  if (config.discountMode === "UNICO") {
    pct = config.discountPct as number;
    regla = { tipo: "UNICO", pct, desde: null };
  } else if (config.discountMode === "PROGRESIVO") {
    const r = validarReglasDescuento(config.discountRules);
    if (r.ok) {
      const alcanzadas = r.reglas.filter((x) => fotosParaUmbral >= x.desde);
      const mejor = alcanzadas.reduce<ReglaDescuento | null>((m, x) => (m === null || x.desde > m.desde ? x : m), null);
      if (mejor) {
        pct = mejor.pct;
        regla = { tipo: "PROGRESIVO", pct, desde: mejor.desde };
      }
    }
  }
  const descuento = Math.min(subtotal, Math.max(0, Math.round((subtotal * pct) / 100)));
  return {
    incluidas: incluidasFinal,
    extras,
    yaPagadas,
    paquetes,
    fotosQueFaltanParaPaquete: faltan,
    subtotalCents: subtotal,
    descuentoCents: descuento,
    totalCents: subtotal - descuento,
    reglaAplicada: regla,
  };
}

/** Texto del aviso del último paquete, o null si no corresponde. */
export function textoFaltanParaPaquete(faltan: number | null): string | null {
  if (faltan === null || faltan <= 0) return null;
  return faltan === 1 ? "Con 1 foto más completás el paquete sin costo adicional." : `Con ${faltan} fotos más completás el paquete sin costo adicional.`;
}
