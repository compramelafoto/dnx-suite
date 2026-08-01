/**
 * Copy público post-pago / email — hechos ya aprobados (Terms v2 + cronograma).
 * No inventa dirección postal exacta.
 */
export const POST_PAYMENT_BRAND = "#F9B114";

export const POST_PAYMENT_TITLE = "¡TU INSCRIPCIÓN ESTÁ CONFIRMADA!";
export const POST_PAYMENT_SUBTITLE =
  "Ya sos parte de la primera edición de Clickatón.";
export const POST_PAYMENT_PAYMENT_SEAL = "PAGO APROBADO";

export const POST_PAYMENT_ACCREDITATION = {
  heading: "ACREDITACIÓN",
  venueName: "Complejo Cultural Fontanarrosa",
  city: "Rosario",
  dateLabel: "19 de septiembre de 2026",
  accreditationWindow: "14:00 a 16:00",
  talkWindow: "16:00 a 16:30",
  presentWithQr:
    "Presentate con tu código QR desde el celular o impreso.",
  /** Dirección postal exacta no confirmada en configuración. */
  venueAddressConfigRequired: true as const,
  venueAddressConfigFlag: "VENUE ADDRESS HUMAN CONFIG REQUIRED",
} as const;

export const POST_PAYMENT_SCHEDULE = [
  { time: "14:00–16:00", label: "Acreditación" },
  { time: "16:00–16:30", label: "Charla introductoria" },
  { time: "16:00–20:00", label: "Ventana válida para tomar fotografías" },
  { time: "16:00–22:00", label: "Carga de fotografías habilitada" },
] as const;

export const POST_PAYMENT_CAPTURE_WARNING =
  "Las fotografías tomadas fuera de 16:00 a 20:00 no serán válidas.";

export const POST_PAYMENT_EMAIL_HELP =
  "Si no lo encontrás, revisá Spam, Promociones o buscá noreply@maratonfotografica.com.";

export const PRODUCTION_SITE_ORIGIN = "https://maratonfotografica.com";
