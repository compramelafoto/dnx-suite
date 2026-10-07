/**
 * Presupuestos (etapa 2, Entrega A). Módulo PURO: valores, tipos de las instantáneas y su
 * validación. Lo leen el cálculo de totales, las versiones, el editor y la página pública.
 *
 * Los valores guardados van en mayúsculas, como en el CHECK del SQL
 * (`20261020120000_fotoffice_etapa_2_presupuestos`). El modo de precio vive dentro del JSON de
 * ítems y el SQL no lo puede chequear: por eso se valida acá (`validarItem`).
 */

// --- Estados ----------------------------------------------------------------------------------

export const ESTADOS_PRESUPUESTO = ["BORRADOR", "ENVIADO", "VISTO", "ACEPTADO", "RECHAZADO", "VENCIDO"] as const;
export type EstadoPresupuesto = (typeof ESTADOS_PRESUPUESTO)[number];

export const ETIQUETA_ESTADO: Record<EstadoPresupuesto, string> = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  VISTO: "Visto",
  ACEPTADO: "Aceptado",
  RECHAZADO: "Rechazado",
  VENCIDO: "Vencido",
};

export function esEstadoPresupuesto(v: unknown): v is EstadoPresupuesto {
  return typeof v === "string" && (ESTADOS_PRESUPUESTO as readonly string[]).includes(v);
}

// --- Modos de precio --------------------------------------------------------------------------

/** LISTA: el precio del catálogo (editable). CALCULO: el sugerido por ¿Cuánto Cobro? (ajustable). */
export const MODOS_PRECIO = ["LISTA", "CALCULO"] as const;
export type ModoPrecio = (typeof MODOS_PRECIO)[number];

export const ETIQUETA_MODO_PRECIO: Record<ModoPrecio, string> = {
  LISTA: "Precio de lista",
  CALCULO: "Calculado con ¿Cuánto Cobro?",
};

export function esModoPrecio(v: unknown): v is ModoPrecio {
  return typeof v === "string" && (MODOS_PRECIO as readonly string[]).includes(v);
}

// --- Valores por omisión ----------------------------------------------------------------------

export const VALIDEZ_POR_OMISION_DIAS = 15;
export const SEGUIMIENTO_POR_OMISION_DIAS = 3;
/** Secuencia de numeración (`FotofficeRecordNumber.entityType`). */
export const ENTIDAD_NUMERACION = "PRESUPUESTO";
export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

// --- Descuentos -------------------------------------------------------------------------------

/** PORCENTAJE: 0 a 100. MONTO: pesos sobre el renglón (o sobre el total, si es global). */
export const TIPOS_DESCUENTO = ["PORCENTAJE", "MONTO"] as const;
export type TipoDescuento = (typeof TIPOS_DESCUENTO)[number];

export type Descuento = { tipo: TipoDescuento; valor: number };

export function esTipoDescuento(v: unknown): v is TipoDescuento {
  return typeof v === "string" && (TIPOS_DESCUENTO as readonly string[]).includes(v);
}

// --- Instantánea del cálculo ------------------------------------------------------------------

/**
 * Lo que queda guardado de un cálculo de ¿Cuánto Cobro? junto al ítem. Tiene costos y márgenes:
 * es INTERNO. Nunca viaja a la página pública ni al navegador de quien no ve costos
 * (`itemSinDatosInternos`).
 */
export type InstantaneaCalculo = {
  motor: "cuanto-cobro-core";
  calculadoEn: string;
  moneda: string;
  /** Precio recomendado del motor (con el posicionamiento comercial). */
  precioRecomendado: number;
  /** Precio mínimo sostenible: por debajo, el trabajo pierde plata. */
  precioMinimo: number;
  /** El precio que eligió el motor: el manual si se cargó, si no el recomendado. */
  precioSugerido: number;
  valorHora: number;
  horasTotales: number;
  costoHumano: number;
  costosVariables: number;
  /** Margen del precio sugerido, en pesos y como proporción (null si no se puede calcular). */
  margen: number;
  margenProporcion: number | null;
  estadoRentabilidad: string;
  posicionamiento: string;
  advertencias: string[];
  /** Lo que se cargó en el panel (horas, costos, margen deseado), para reabrirlo. */
  entrada: unknown;
};

// --- Ítem ---------------------------------------------------------------------------------------

export type ItemPresupuesto = {
  /** Clave del renglón dentro de la versión (no es un id de la base). */
  id: string;
  /** Producto del catálogo, si salió de ahí; null en un ítem de texto libre. */
  productId: string | null;
  nombre: string;
  descripcion: string | null;
  cantidad: number;
  /** Pesos, con dos decimales. */
  precioUnitario: number;
  descuento: Descuento | null;
  modoPrecio: ModoPrecio;
  /** Sólo en modo CALCULO. */
  calculo: InstantaneaCalculo | null;
  seccion: string | null;
  /** Se muestra aparte y no suma al total. */
  opcional: boolean;
};

/** El ítem tal como lo ven el cliente y quien no tiene permiso de costos. */
export type ItemPublico = Omit<ItemPresupuesto, "calculo" | "productId">;

/** Saca la instantánea del cálculo (costos y márgenes) y el id del catálogo. */
export function itemSinDatosInternos(item: ItemPresupuesto): ItemPublico {
  return {
    id: item.id,
    nombre: item.nombre,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitario,
    descuento: item.descuento ? { ...item.descuento } : null,
    modoPrecio: item.modoPrecio,
    seccion: item.seccion,
    opcional: item.opcional,
  };
}

// --- Validación -----------------------------------------------------------------------------------

export const TOPE_IMPORTE = 999_999_999.99;
export const TOPE_CANTIDAD = 100_000;

export type ResultadoValidacion<T> = { ok: true; valor: T } | { ok: false; error: string };

function numeroFinito(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function textoOpcional(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function validarDescuento(raw: unknown): ResultadoValidacion<Descuento | null> {
  if (raw === null || raw === undefined) return { ok: true, valor: null };
  const d = raw as { tipo?: unknown; valor?: unknown };
  if (!esTipoDescuento(d.tipo)) return { ok: false, error: "El tipo de descuento no es válido." };
  const valor = numeroFinito(d.valor);
  if (valor === null || valor < 0) return { ok: false, error: "El descuento tiene que ser un número positivo." };
  if (d.tipo === "PORCENTAJE" && valor > 100) return { ok: false, error: "El descuento no puede pasar del 100 %." };
  if (d.tipo === "MONTO" && valor > TOPE_IMPORTE) return { ok: false, error: "El descuento es demasiado grande." };
  if (valor === 0) return { ok: true, valor: null };
  return { ok: true, valor: { tipo: d.tipo, valor } };
}

/**
 * Valida un ítem que llega del navegador o de la base (JSON). No confía en nada: el modo de
 * precio, los números y los textos se revisan acá porque el SQL no puede.
 */
export function validarItem(raw: unknown): ResultadoValidacion<ItemPresupuesto> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "El ítem no es válido." };
  const r = raw as Record<string, unknown>;
  const nombre = textoOpcional(r.nombre);
  if (!nombre) return { ok: false, error: "Cada ítem necesita un nombre." };
  if (nombre.length > 200) return { ok: false, error: "El nombre del ítem es demasiado largo." };
  if (!esModoPrecio(r.modoPrecio)) return { ok: false, error: `El modo de precio de "${nombre}" no es válido.` };
  const cantidad = numeroFinito(r.cantidad);
  if (cantidad === null || cantidad <= 0 || cantidad > TOPE_CANTIDAD) {
    return { ok: false, error: `La cantidad de "${nombre}" no es válida.` };
  }
  const precio = numeroFinito(r.precioUnitario);
  if (precio === null || precio < 0 || precio > TOPE_IMPORTE) {
    return { ok: false, error: `El precio de "${nombre}" no es válido.` };
  }
  const descuento = validarDescuento(r.descuento);
  if (!descuento.ok) return { ok: false, error: `${descuento.error} (${nombre})` };
  const calculo = r.modoPrecio === "CALCULO" && r.calculo && typeof r.calculo === "object"
    ? (r.calculo as InstantaneaCalculo)
    : null;
  const id = textoOpcional(r.id);
  if (!id) return { ok: false, error: "El ítem no tiene clave." };
  return {
    ok: true,
    valor: {
      id,
      productId: textoOpcional(r.productId),
      nombre,
      descripcion: textoOpcional(r.descripcion),
      cantidad,
      precioUnitario: Math.round(precio * 100) / 100,
      descuento: descuento.valor,
      modoPrecio: r.modoPrecio,
      calculo,
      seccion: textoOpcional(r.seccion),
      opcional: r.opcional === true,
    },
  };
}

export function validarItems(raw: unknown): ResultadoValidacion<ItemPresupuesto[]> {
  if (!Array.isArray(raw)) return { ok: false, error: "Los ítems no son válidos." };
  if (raw.length > 200) return { ok: false, error: "Un presupuesto admite hasta 200 ítems." };
  const items: ItemPresupuesto[] = [];
  const claves = new Set<string>();
  for (const x of raw) {
    const v = validarItem(x);
    if (!v.ok) return v;
    if (claves.has(v.valor.id)) return { ok: false, error: "Hay dos ítems con la misma clave." };
    claves.add(v.valor.id);
    items.push(v.valor);
  }
  return { ok: true, valor: items };
}
