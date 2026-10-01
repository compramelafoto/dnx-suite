/**
 * Constantes del módulo de clientes.
 *
 * La clave `clients` ya estaba reservada como `PLANNED` en `lib/modules/registry.ts` desde
 * antes de que existiera una línea de código, igual que pasó con reservas y con sorteos.
 */

export const CLIENTS_MODULE_KEY = "clients";

/**
 * Condición frente al IVA.
 *
 * Se guarda desde el día uno aunque la facturación sea la etapa 6: una venta que no guardó
 * la condición fiscal del comprador no se puede facturar nunca más.
 *
 * Texto y no enum de Prisma: el esquema lo comparten las cinco aplicaciones de la suite.
 */
export const IVA_CONDITIONS = [
  "CONSUMIDOR_FINAL",
  "RESPONSABLE_INSCRIPTO",
  "MONOTRIBUTO",
  "EXENTO",
  "NO_CATEGORIZADO",
] as const;

export type IvaCondition = (typeof IVA_CONDITIONS)[number];

export const IVA_CONDITION_LABELS: Record<IvaCondition, string> = {
  CONSUMIDOR_FINAL: "Consumidor final",
  RESPONSABLE_INSCRIPTO: "Responsable inscripto",
  MONOTRIBUTO: "Monotributo",
  EXENTO: "Exento",
  NO_CATEGORIZADO: "No categorizado",
};

export const DOC_TYPES = ["DNI", "CUIT", "CUIL", "PASAPORTE", "OTRO"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const CLIENT_KINDS = ["PERSONA", "EMPRESA"] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];

export const CLIENT_STATUSES = ["ACTIVO", "INACTIVO"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
