/**
 * Clickatón legal content for the registration funnel (11B TEST).
 * Marked for Daniel legal review before LIVE.
 */

export const CLICKATON_TERMS_VERSION = "2026-07-23-test-v1";
export const CLICKATON_PRIVACY_VERSION = "2026-07-23-test-v1";

export const clickatonLegalFunnelContent = {
  termsVersion: CLICKATON_TERMS_VERSION,
  privacyVersion: CLICKATON_PRIVACY_VERSION,
  legalReviewRequired: true as const,
  termsSections: [
    {
      title: "Inscripción y cupos",
      body: "La inscripción a una edición Clickatón TEST reserva un cupo por un tiempo limitado. Si el pago no se acredita antes del vencimiento, la reserva se libera automáticamente.",
    },
    {
      title: "Pago (entorno de prueba)",
      body: "En este entorno las transacciones son de prueba (sandbox). No se realiza un cobro real. En producción, el cobro se procesará mediante los proveedores de pago habilitados por Clickatón / DNX Payments.",
    },
    {
      title: "Cancelaciones y devoluciones",
      body: "La política definitiva de cancelaciones y devoluciones será publicada antes del go-live comercial. En TEST no hay obligaciones económicas reales. [PENDIENTE VALIDACIÓN JURÍDICA — Daniel]",
    },
    {
      title: "Kit, QR y credencial",
      body: "Tras la confirmación, el participante accede a un QR y credencial digitales desde Mi cuenta. El QR es personal e intransferible y podrá usarse para acreditación en sede.",
    },
    {
      title: "Datos personales e imagen",
      body: "Los datos se usan para gestionar la inscripción, comunicaciones del evento y acreditación. El consentimiento de imagen, si se otorga, autoriza el uso en piezas de difusión del evento según la política de privacidad.",
    },
    {
      title: "Cambios de fecha o sede",
      body: "Clickatón podrá modificar fecha, sede o cronograma por razones operativas, comunicándolo por los canales oficiales. [PENDIENTE VALIDACIÓN JURÍDICA — Daniel]",
    },
    {
      title: "Contacto",
      body: "Para soporte de inscripción TEST usá el formulario de contacto del sitio o el canal indicado en Mi cuenta.",
    },
  ],
  privacySections: [
    {
      title: "Responsable",
      body: "Clickatón / DNX Suite trata los datos de inscripción para operar el evento y la plataforma.",
    },
    {
      title: "Datos tratados",
      body: "Nombre, email, teléfono, documento (si aplica), ciudad, consentimientos, datos de pago referenciales (sin almacenar tarjetas) y metadatos de inscripción.",
    },
    {
      title: "Finalidades",
      body: "Gestionar inscripción, pago, confirmación, QR/credencial, comunicaciones del evento y soporte.",
    },
    {
      title: "Conservación",
      body: "Los datos se conservan el tiempo necesario para la edición y obligaciones legales aplicables. [PENDIENTE VALIDACIÓN JURÍDICA — Daniel]",
    },
    {
      title: "Derechos",
      body: "Podés solicitar acceso, rectificación o baja contactando a Clickatón por los canales oficiales.",
    },
  ],
} as const;
