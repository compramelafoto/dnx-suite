/**
 * Textos legales provisionales — PENDIENTE DE REVISIÓN LEGAL.
 * ACCIÓN LEGAL REQUERIDA ANTES DE PRODUCCIÓN.
 */

export const STORE_LEGAL_VERSION = "clickaton-store-legal-provisional-2026-08-01";

export const STORE_LEGAL_PENDING_REVIEW = true;

export const storeLegalDocuments = {
  purchaseTerms: {
    href: "/legal/terminos",
    label: "Términos y condiciones de compra",
    status: "pendiente de revisión legal" as const,
  },
  returns: {
    href: "/legal/privacidad",
    label: "Política de cambios y devoluciones",
    status: "pendiente de revisión legal" as const,
  },
  privacy: {
    href: "/legal/privacidad",
    label: "Política de privacidad",
    status: "pendiente de revisión legal" as const,
  },
  delivery: {
    href: "/legal/terminos",
    label: "Política de entrega y retiro",
    status: "pendiente de revisión legal" as const,
  },
} as const;

export const STORE_LEGAL_PENDING_LIST = [
  "términos y condiciones de compra",
  "política de cambios y devoluciones",
  "política de entrega y retiro",
  "política de privacidad",
  "tratamiento de datos personales",
  "identificación fiscal y comercial del vendedor",
  "plazos de preparación",
  "productos personalizados / sin cambio por personalización",
  "condiciones de disponibilidad",
  "responsabilidad por datos de envío incorrectos",
  "política de cancelación",
  "tratamiento de pagos rechazados o duplicados",
] as const;
