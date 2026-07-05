/** Hechos verificables del producto para redacción editorial. */
export const CLF_KNOWLEDGE = {
  name: "ComprameLaFoto",
  url: "https://www.compramelafoto.com",
  market: "Argentina",
  payment: "Mercado Pago",
  features: [
    "venta de fotografías digitales e impresiones",
    "álbumes y galerías por evento o escuela",
    "packs y descuentos por cantidad",
    "preventa escolar",
    "eventos colaborativos con organizadores",
    "comisiones para organizadores",
    "búsqueda por selfie en eventos masivos",
    "marketplace de fotógrafos",
    "entrega digital automática tras el pago",
    "programa de referidos",
  ],
  referral: {
    commission: "50% del fee de marketplace",
    duration: "12 meses desde el alta del fotógrafo referido",
    whoCanRefer: "cualquier usuario (fotógrafo, organizador, laboratorio o cliente)",
    whoGeneratesCommission: "solo fotógrafos referidos que venden",
    mpRequired: "Mercado Pago conectado al momento de la venta",
    payout: "solicitud de cobro desde Configuración → Referidos",
  },
} as const;
