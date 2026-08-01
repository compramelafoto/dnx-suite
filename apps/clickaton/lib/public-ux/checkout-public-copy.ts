/** Copy público del checkout — sin jerga de infraestructura. */

export const CHECKOUT_PUBLIC_COPY = {
  brickIntro: (expiresLabel: string) =>
    `Reserva hasta ${expiresLabel}. El pago se realiza de forma segura con tarjeta a través de Mercado Pago.`,
  redirectIntro: (amountLabel: string, expiresLabel: string) =>
    `Importe a pagar: ${amountLabel} · Reserva hasta ${expiresLabel}. El pago se realiza de forma segura a través de Mercado Pago.`,
  redirectHint: "Al continuar, accederás al pago seguro de Mercado Pago.",
  testBanner:
    "Entorno de prueba: el pago no usa cuentas reales. La confirmación puede tardar unos minutos; no realices un segundo pago mientras verificamos la operación.",
  preparing: "Preparando el pago seguro…",
  opening: "Abriendo la pantalla de pago…",
  payTest: "Pagar (entorno de prueba)",
  payLive: "Pagar con Mercado Pago",
  freeConfirm: "Confirmar inscripción gratuita",
  afterPay:
    "Cuando completes el pago, confirmaremos automáticamente tu inscripción.",
} as const;

export const CARD_BRICK_PUBLIC_COPY = {
  testBanner:
    "Entorno de prueba: el pago no usa cuentas reales. La confirmación puede tardar unos minutos; no realices un segundo pago mientras verificamos la operación.",
  amountPrefix: "Importe a pagar:",
  loading: "Preparando el pago seguro…",
  loadingHint: "Esto puede tardar unos segundos.",
  processing: "Procesando tu pago… no cierres esta ventana ni vuelvas a pagar.",
  loadError: "No pudimos cargar el formulario de pago. Recargá la página.",
  deviceSession:
    "Todavía estamos preparando la sesión de seguridad. Esperá un momento e intentá de nuevo.",
  scrollHint: "Si el formulario no entra completo, deslizá dentro de este recuadro.",
} as const;
