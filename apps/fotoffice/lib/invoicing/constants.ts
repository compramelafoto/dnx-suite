/**
 * Constantes de la facturación electrónica con ARCA (§11 del diseño de negocio).
 *
 * Todo texto y ningún enum de Prisma: el esquema lo comparten las cinco aplicaciones.
 * Módulo PURO.
 */

export const INVOICING_MODULE_KEY = "invoicing";

export const ARCA_ENVIRONMENTS = ["HOMOLOGACION", "PRODUCCION"] as const;
export type ArcaEnvironment = (typeof ARCA_ENVIRONMENTS)[number];

export const ENVIRONMENT_LABELS: Record<ArcaEnvironment, string> = {
  HOMOLOGACION: "Pruebas (homologación)",
  PRODUCCION: "Producción",
};

export function esAmbiente(v: unknown): v is ArcaEnvironment {
  return v === "HOMOLOGACION" || v === "PRODUCCION";
}

/** Las direcciones de los dos servicios, por ambiente. */
export const ARCA_URLS: Record<ArcaEnvironment, { wsaa: string; wsfe: string }> = {
  HOMOLOGACION: {
    wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  },
  PRODUCCION: {
    wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
  },
};

/** El servicio de negocio para el que se pide el ticket. */
export const WSFE_SERVICE = "wsfe";

// --- Comprobantes ---------------------------------------------------------------------------

/** Tipos de comprobante que emite esta versión: sólo clase C (§11.2.1). */
export const CBTE_FACTURA_C = 11;
export const CBTE_NOTA_CREDITO_C = 13;
export type CbteTipo = typeof CBTE_FACTURA_C | typeof CBTE_NOTA_CREDITO_C;

export const CBTE_LABELS: Record<CbteTipo, string> = {
  [CBTE_FACTURA_C]: "Factura C",
  [CBTE_NOTA_CREDITO_C]: "Nota de crédito C",
};

/** Concepto: qué se factura. Con servicios, ARCA pide el período y el vencimiento del pago. */
export const CONCEPTOS = { PRODUCTOS: 1, SERVICIOS: 2, AMBOS: 3 } as const;
export type Concepto = 1 | 2 | 3;
export const CONCEPTO_LABELS: Record<Concepto, string> = {
  1: "Productos",
  2: "Servicios",
  3: "Productos y servicios",
};

export const INVOICE_STATUSES = ["BORRADOR", "PENDIENTE", "AUTORIZADA", "RECHAZADA", "ANULADA"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  BORRADOR: "Sin emitir",
  PENDIENTE: "Esperando respuesta de ARCA",
  AUTORIZADA: "Autorizada",
  RECHAZADA: "Rechazada por ARCA",
  ANULADA: "Anulada con nota de crédito",
};

// --- Receptor -------------------------------------------------------------------------------

/** Tipos de documento de ARCA (tabla FEParamGetTiposDoc). */
export const DOC_TIPO = { CUIT: 80, CUIL: 86, DNI: 96, PASAPORTE: 94, SIN_IDENTIFICAR: 99 } as const;

/** Del `docType` del cliente de FOTOFFICE al código de ARCA. */
export const DOC_TIPO_DE_CLIENTE: Record<string, number> = {
  CUIT: DOC_TIPO.CUIT,
  CUIL: DOC_TIPO.CUIL,
  DNI: DOC_TIPO.DNI,
  PASAPORTE: DOC_TIPO.PASAPORTE,
};

export const DOC_TIPO_LABELS: Record<number, string> = {
  80: "CUIT",
  86: "CUIL",
  96: "DNI",
  94: "Pasaporte",
  99: "Sin identificar",
};

/**
 * Condición frente al IVA del receptor (`CondicionIVAReceptorId`, obligatoria desde 2025 por la
 * RG 5616; tabla FEParamGetCondicionIvaReceptor). Del `ivaCondition` del cliente al código.
 */
export const CONDICION_IVA_RECEPTOR: Record<string, number> = {
  RESPONSABLE_INSCRIPTO: 1,
  EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  MONOTRIBUTO: 6,
  NO_CATEGORIZADO: 7,
};

export const CONDICION_IVA_LABELS: Record<string, string> = {
  RESPONSABLE_INSCRIPTO: "Responsable inscripto",
  EXENTO: "Exento",
  CONSUMIDOR_FINAL: "Consumidor final",
  MONOTRIBUTO: "Monotributo",
  NO_CATEGORIZADO: "No categorizado",
};

/** Condición del emisor. Esta versión sólo emite clase C: monotributo o exento. */
export const CONDICIONES_EMISOR = ["MONOTRIBUTO", "EXENTO"] as const;
export type CondicionEmisor = (typeof CONDICIONES_EMISOR)[number];

/**
 * Desde este total, un consumidor final se tiene que identificar con su documento (RG 5700/2025:
 * $10.000.000). Se guarda en pesos. Confirmarlo con el contador si ARCA lo actualiza.
 */
export const TOPE_CONSUMIDOR_FINAL_ANONIMO_ARS = 10_000_000;

// --- Tiempos --------------------------------------------------------------------------------

/** Un ticket que vence en menos de esto se renueva antes de usarlo. */
export const TICKET_MARGEN_MS = 10 * 60 * 1000;
/** Tiempo de espera de cada llamada a ARCA. */
export const ARCA_TIMEOUT_MS = 30 * 1000;
/**
 * Un comprobante PENDIENTE se concilia recién pasado este tiempo desde que salió: ARCA puede
 * estar todavía procesando el pedido que se cortó, y conciliar antes podría liberar un número
 * que en realidad se está autorizando.
 */
export const CONCILIAR_DESPUES_MS = 2 * 60 * 1000;
