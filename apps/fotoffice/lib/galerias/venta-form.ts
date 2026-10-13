/**
 * Formulario de la pestaña Venta de la galería (etapa 7, Entrega A2). Módulo PURO: lo usan el navegador
 * (vista previa del carrito) y el servidor (al guardar), así los dos entienden igual lo que se escribió.
 * Los importes se escriben como en el resto de la aplicación ("1.500,00") y se pasan a centavos enteros.
 */
import { parseAmountToMinor } from "@/lib/membership/history-import/amount";
import { MODOS_VENTA, type ModoVenta } from "./constantes";
import {
  MAX_REGLAS_DESCUENTO, MENSAJES_PRECIOS, calcularCarrito, formatearCentavos, validarConfigVenta,
  type Carrito, type ConfigVenta, type ModoDescuento, type ModoPrecio,
} from "./precios";

export const ETIQUETA_MODO_VENTA: Record<ModoVenta, string> = {
  SELECCION: "Sólo selección",
  SELECCION_Y_VENTA: "Selección con venta de extras",
  VENTA: "Sólo venta",
};

export const AYUDA_MODO_VENTA: Record<ModoVenta, string> = {
  SELECCION: "El cliente elige las fotos y las envía. No se cobra nada.",
  SELECCION_Y_VENTA: "Algunas fotos van incluidas sin costo; las que elija de más las paga antes de enviar.",
  VENTA: "El cliente paga cada foto que elige. No hay fotos incluidas.",
};

export const ETIQUETA_MODO_PRECIO: Record<ModoPrecio, string> = { POR_FOTO: "Por foto", PAQUETE: "Por paquete" };
export const ETIQUETA_MODO_DESCUENTO: Record<ModoDescuento, string> = { NINGUNO: "Sin descuento", UNICO: "Descuento único", PROGRESIVO: "Descuento progresivo" };

export const EJEMPLO_IMPORTE = "Ej.: 1.500,00";

export const MENSAJES_VENTA_FORM = {
  datosInvalidos: "Los datos de la venta no son válidos.",
  importeInvalido: "El importe no es válido. Escribilo así: 1.500,00",
  rubroInvalido: "Ese rubro de ingreso no existe o no está activo.",
} as const;

export type ReglaFormulario = { pct: string; desde: string };

export type FormularioVenta = {
  saleMode: string;
  includedCount: string;
  pricingMode: string;
  unitPrice: string;
  packageSize: string;
  packagePrice: string;
  discountMode: string;
  discountPct: string;
  reglas: ReglaFormulario[];
  incomeCategoryId: string;
};

/** Centavos → "1.500,00" para cargarlo en un campo. */
export function centavosAFormulario(centavos: number | null): string {
  if (centavos === null) return "";
  return (centavos / 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const texto = (v: unknown): string | null => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : v === null || v === undefined ? "" : null);

/** Valida la forma de lo que llega (el navegador o una acción) y lo deja como texto. null si no es un formulario. */
export function leerFormularioVenta(datos: unknown): FormularioVenta | null {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return null;
  const d = datos as Record<string, unknown>;
  const campos = ["saleMode", "includedCount", "pricingMode", "unitPrice", "packageSize", "packagePrice", "discountMode", "discountPct", "incomeCategoryId"] as const;
  const out: Record<string, string> = {};
  for (const c of campos) {
    const t = texto(d[c]);
    if (t === null || t.length > 40) return null;
    out[c] = t.trim();
  }
  const reglasCrudas = d.reglas === undefined || d.reglas === null ? [] : d.reglas;
  if (!Array.isArray(reglasCrudas) || reglasCrudas.length > MAX_REGLAS_DESCUENTO + 4) return null;
  const reglas: ReglaFormulario[] = [];
  for (const r of reglasCrudas) {
    if (!r || typeof r !== "object" || Array.isArray(r)) return null;
    const pct = texto((r as Record<string, unknown>).pct);
    const desde = texto((r as Record<string, unknown>).desde);
    if (pct === null || desde === null || pct.length > 10 || desde.length > 10) return null;
    reglas.push({ pct: pct.trim(), desde: desde.trim() });
  }
  return { ...(out as Omit<FormularioVenta, "reglas">), reglas };
}

/** "12" → 12; "" → null; cualquier otra cosa → NaN (la validación lo rechaza con su mensaje). */
function entero(t: string): number | null {
  if (t === "") return null;
  return /^\d{1,9}$/.test(t) ? Number(t) : Number.NaN;
}

function importe(t: string): { centavos: number | null } | { error: string } {
  if (t === "") return { centavos: null };
  const r = parseAmountToMinor(t);
  return r.ok ? { centavos: r.minor } : { error: MENSAJES_VENTA_FORM.importeInvalido };
}

export type ResultadoFormularioVenta =
  | { ok: true; config: ConfigVenta; rubroId: string | null }
  | { ok: false; errores: string[] };

/**
 * Del formulario a la configuración (centavos y números) ya validada con `validarConfigVenta`. Con "Sólo
 * selección" no se mira nada de precios ni de descuentos. Las reglas del descuento progresivo se ordenan de
 * menor a mayor cantidad (las filas vacías se ignoran).
 */
export function aConfigVenta(f: FormularioVenta): ResultadoFormularioVenta {
  if (!(MODOS_VENTA as readonly string[]).includes(f.saleMode)) return { ok: false, errores: [MENSAJES_PRECIOS.modoVentaInvalido] };
  const saleMode = f.saleMode as ModoVenta;
  const rubroId = f.incomeCategoryId === "" ? null : f.incomeCategoryId;
  const incluidas = entero(f.includedCount);

  if (saleMode === "SELECCION") {
    return {
      ok: true,
      rubroId,
      config: { saleMode, includedCount: 0, pricingMode: null, unitPriceCents: null, packageSize: null, packagePriceCents: null, discountMode: "NINGUNO", discountPct: null, discountRules: null },
    };
  }

  const errores: string[] = [];
  const unit = importe(f.unitPrice);
  const paquete = importe(f.packagePrice);
  if ("error" in unit && f.pricingMode === "POR_FOTO") errores.push(unit.error);
  if ("error" in paquete && f.pricingMode === "PAQUETE") errores.push(paquete.error);
  if (errores.length > 0) return { ok: false, errores };

  const pricingMode = f.pricingMode === "POR_FOTO" || f.pricingMode === "PAQUETE" ? f.pricingMode : null;
  const discountMode = f.discountMode === "UNICO" || f.discountMode === "PROGRESIVO" ? f.discountMode : f.discountMode === "NINGUNO" || f.discountMode === "" ? "NINGUNO" : null;
  const reglas = f.reglas
    .filter((r) => r.pct !== "" || r.desde !== "")
    .map((r) => ({ pct: entero(r.pct) ?? Number.NaN, desde: entero(r.desde) ?? Number.NaN }))
    .sort((a, b) => a.desde - b.desde);
  const config: ConfigVenta = {
    saleMode,
    // En "Sólo venta" no hay incluidas: el campo no se muestra y se ignora lo que haya quedado escrito.
    includedCount: saleMode === "VENTA" ? 0 : (incluidas ?? 0),
    pricingMode,
    unitPriceCents: pricingMode === "POR_FOTO" && "centavos" in unit ? unit.centavos : null,
    packageSize: pricingMode === "PAQUETE" ? entero(f.packageSize) : null,
    packagePriceCents: pricingMode === "PAQUETE" && "centavos" in paquete ? paquete.centavos : null,
    discountMode: (discountMode ?? "NINGUNO") as ModoDescuento,
    discountPct: discountMode === "UNICO" ? entero(f.discountPct) : null,
    discountRules: discountMode === "PROGRESIVO" ? reglas : null,
  };
  if (discountMode === null) return { ok: false, errores: [MENSAJES_PRECIOS.modoDescuentoInvalido] };
  const v = validarConfigVenta(config);
  return v.ok ? { ok: true, config, rubroId } : { ok: false, errores: v.errores };
}

// --- Vista previa del carrito --------------------------------------------------------------------------

export const EJEMPLOS_EXTRAS = [1, 5, 20] as const;

export type EjemploCarrito = {
  extras: number;
  subtotalCents: number;
  descuentoCents: number;
  totalCents: number;
  /** "10 % desde 5 fotos" / "10 %"; null si no hay descuento para ese ejemplo. */
  descuento: string | null;
  carrito: Carrito;
};

export function textoReglaAplicada(c: Carrito): string | null {
  const r = c.reglaAplicada;
  if (!r || c.descuentoCents <= 0) return null;
  return r.tipo === "PROGRESIVO" && r.desde !== null ? `${r.pct} % desde ${r.desde} fotos` : `${r.pct} %`;
}

/**
 * El carrito de un cliente que eligió las incluidas más 1, 5 y 20 extras (con la misma función que usa el
 * servidor para cobrar). Vacío si la configuración no cobra nada.
 */
export function ejemplosDeCarrito(config: ConfigVenta): EjemploCarrito[] {
  if (config.saleMode === "SELECCION" || !validarConfigVenta(config).ok) return [];
  const incluidas = config.saleMode === "VENTA" ? 0 : config.includedCount;
  return EJEMPLOS_EXTRAS.map((extras) => {
    const total = incluidas + extras;
    const seleccion = Array.from({ length: total }, (_, i) => ({ fotoId: `ejemplo-${String(i).padStart(4, "0")}`, seleccionadaEn: new Date(2026, 0, 1, 0, 0, i) }));
    const carrito = calcularCarrito({ config, seleccion, pagadas: new Set() });
    return {
      extras,
      subtotalCents: carrito.subtotalCents,
      descuentoCents: carrito.descuentoCents,
      totalCents: carrito.totalCents,
      descuento: textoReglaAplicada(carrito),
      carrito,
    };
  });
}

export { formatearCentavos };
