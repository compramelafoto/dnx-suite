/**
 * Bases y Condiciones + Privacidad — funnel de inscripción Clickatón.
 *
 * v1: `CLICKATON_TERMS_2026_09_19_v1` — cronograma histórico (17–21); conservada para audit.
 * v2: `CLICKATON_TERMS_2026_09_19_v2` — Schedule V2 (captura 16–20 / upload 16–22).
 *
 * Decisión humana: cronograma V2 definitivo. Nuevas inscripciones aceptan v2.
 * No sobrescribir aceptaciones históricas de v1.
 *
 * LEGAL APPROVED FOR REGISTRATION — v2 vigente en ventas públicas (10G.8).
 * Consentimientos del funnel consolidados en estas Bases (un solo checkbox de aceptación).
 */
import {
  CLICKATON_TERMS_VERSION as EDITION_TERMS_VERSION,
  CLICKATON_TERMS_VERSION_V1,
} from "@/config/editions/argentina-2026";

/** Alias canónico publicado (mismo id que edición AR2026 — v2). */
export const CLICKATON_TERMS_VERSION = EDITION_TERMS_VERSION;
export const CLICKATON_TERMS_VERSION_LEGACY_V1 = CLICKATON_TERMS_VERSION_V1;
export const CLICKATON_PRIVACY_VERSION = "CLICKATON_PRIVACY_2026_09_19_v1" as const;

export const clickatonLegalFunnelContent = {
  termsVersion: CLICKATON_TERMS_VERSION,
  privacyVersion: CLICKATON_PRIVACY_VERSION,
  /**
   * Cronograma V2 materialmente distinto a v1.
   * Ventas públicas: confirmar formalmente v2 antes de GO (registrationEnabled).
   * El texto v2 ya está PUBLISHED para que nuevas aceptaciones apunten a v2.
   */
  legalReviewRequired: false as const,
  legalV2HumanConfirmationPendingBeforeSales: true as const,
  publicationStatus: "PUBLISHED" as const,
  approvedForRegistrationAt: "2026-07-31" as const,
  scheduleV2EffectiveAt: "2026-07-31" as const,
  supersedesTermsVersion: CLICKATON_TERMS_VERSION_LEGACY_V1,
  termsSections: [
    {
      title: "Organizador y alcance",
      body: "Estas Bases y Condiciones (versión CLICKATON_TERMS_2026_09_19_v2) rigen la inscripción y participación en Clickatón Argentina 2026 (edición del 19 de septiembre de 2026, Rosario, Santa Fe, República Argentina). La inscripción implica la aceptación expresa de esta versión publicada, de las reglas de la edición y de la Política de Privacidad publicada en el sitio. El organizador opera la plataforma a través de Clickatón / DNX Suite.",
    },
    {
      title: "Cronograma del día del evento (hora Argentina)",
      body: "Acreditación: 14:00 a 16:00. Charla introductoria: 16:00 a 16:30. Ventana válida de captura de fotografías: desde las 16:00 inclusive hasta las 20:00 exclusive (las fotos tomadas antes de las 16:00 o desde las 20:00 en adelante no serán válidas). Ventana habilitada para carga: desde las 16:00 inclusive hasta las 22:00 exclusive. La plataforma permanecerá abierta hasta las 22:00 para permitir selección, revelado y carga. El horario de upload no modifica la validez de la hora de captura: la validez se determina por la metadata de captura (p. ej. DateTimeOriginal / EXIF) según el mecanismo técnico de la plataforma. La organización podrá verificar el horario mediante los metadatos de cada archivo.",
    },
    {
      title: "Inscripción, cupos y edad",
      body: "La inscripción reserva un cupo sujeto a disponibilidad y al pago correspondiente cuando el ticket sea oneroso. Si el pago no se acredita antes del vencimiento de la reserva, el cupo se libera. La participación en esta edición está orientada a personas mayores de 18 años. Quien se inscribe declara contar con capacidad legal para contratar.",
    },
    {
      title: "Precio y medio de pago",
      body: "El precio vigente es el de la fase comercial activa al momento del checkout (primera etapa: $25.000 ARS según calendario publicado). El cobro se procesa mediante Mercado Pago u otros proveedores habilitados por DNX Payments. El resumen de compra muestra el monto antes de pagar. No se aceptan pagos fuera de los canales oficiales.",
    },
    {
      title: "Cancelaciones y devoluciones",
      body: "Salvo disposición legal imperativa en contrario, la inscripción paga confirmada no es reembolsable por desistimiento unilateral del participante. Ante cancelación o reprogramación del evento por el organizador, se comunicará por canales oficiales la opción aplicable (reprogramación, crédito o reembolso según el caso). Solicitudes de soporte: canales oficiales del sitio / Mi cuenta.",
    },
    {
      title: "Kit, remera, QR y credencial",
      body: "Tras la confirmación del pago, el participante accede a QR y credencial digitales desde Mi cuenta. El QR es personal e intransferible y podrá usarse para acreditación en sede. El beneficio de remera oficial (primeros 100 participantes confirmados o hasta el 30/08/2026 23:59:59.999 hora Argentina, lo que ocurra primero) requiere elección de talle al inscribirse cuando el beneficio aplique. El beneficio no constituye venta de merchandising en storefront.",
    },
    {
      title: "Datos personales, Cuenta DNX e imagen",
      body: "Los datos se usan para gestionar la inscripción, comunicaciones del evento, acreditación y operación de la Cuenta DNX (identidad compartida en la suite: Clickatón y aplicaciones vinculadas). El tratamiento de la foto de perfil y de la placa de bienvenida se rige por la cláusula «Foto de perfil y placa de bienvenida» de estas Bases y por la Política de Privacidad. Al aceptar estas Bases, el participante acepta también dicha Política de Privacidad y el tratamiento de datos allí descrito.",
    },
    {
      title: "Foto de perfil y placa de bienvenida",
      body: "Al inscribirse, el participante carga una foto de perfil y, al aceptar estas Bases, autoriza el uso de esa foto para generar y mostrar su placa de bienvenida (Welcome Card) en el marco de Clickatón / DNX Suite: visualización en Mi cuenta, descarga por el participante, uso operativo/comunicacional del evento vinculado a su inscripción e identificación en piezas digitales del participante. También autoriza la publicación social de su placa cuando la organización lo active; la publicación no es automática ni inmediata al inscribirse. Esta autorización forma parte de la aceptación de estas Bases cuando el flujo exige foto de perfil. No implica cesión de derechos de autor sobre otras fotografías del participante.",
    },
    {
      title: "Fotografías, personas identificables y licencia promocional",
      body: "Al aceptar estas Bases, el participante declara ser responsable de contar con las autorizaciones necesarias respecto de personas identificables en las fotografías que presente, con especial atención si aparecen menores. Otorga al organizador una licencia no exclusiva, no transferente de autoría, para difusión promocional (web, redes, prensa, muestras, archivo) de las obras presentadas, conservando la titularidad de autor. Asimismo autoriza el uso de su imagen en el marco operativo y comunicacional del evento, en los términos de estas Bases y de la Política de Privacidad.",
    },
    {
      title: "Reglas de la edición y consignas",
      body: "El día del evento rigen las reglas operativas de la edición (horario, consignas, límites de envío, criterios técnicos). Hay 10 consignas (1 fotografía por consigna); el mínimo competitivo es 8 obras válidas según ventana de captura. Las consignas se liberan desde las 16:00 según el cronograma oficial. El incumplimiento de reglas técnicas o de integridad (incluida captura fuera de ventana) puede invalidar obras o la participación competitiva sin derecho a reembolso de la inscripción, sin perjuicio de derechos irrenunciables del consumidor cuando correspondan.",
    },
    {
      title: "Cambios de fecha, sede o cronograma",
      body: "Clickatón podrá modificar fecha, sede o cronograma por razones operativas, de fuerza mayor o seguridad, comunicándolo por los canales oficiales. El mal tiempo no implica cancelación automática. Esta versión v2 sustituye el cronograma de la v1 para nuevas aceptaciones; las aceptaciones históricas de v1 se conservan en auditoría.",
    },
    {
      title: "Jurisdicción",
      body: "Salvo normas de orden público aplicables, estas Bases se interpretan conforme a la ley de la República Argentina. Para controversias, serán competentes los tribunales ordinarios de Rosario, Provincia de Santa Fe, sin perjuicio de los fueros del consumidor cuando corresponda.",
    },
    {
      title: "Contacto",
      body: "Para soporte de inscripción usá el formulario de contacto del sitio o el canal indicado en Mi cuenta.",
    },
  ],
  privacySections: [
    {
      title: "Responsable",
      body: "Clickatón / DNX Suite trata los datos de inscripción para operar el evento, la plataforma y la Cuenta DNX del participante.",
    },
    {
      title: "Datos tratados",
      body: "Nombre, email, teléfono, documento (si aplica), ciudad, talle (si aplica), consentimientos, foto de perfil destinada a la placa de bienvenida, datos de pago referenciales (sin almacenar tarjetas) y metadatos de inscripción/acreditación.",
    },
    {
      title: "Finalidades",
      body: "Gestionar inscripción, pago, confirmación, QR/credencial, beneficio de kit/remera, generación y entrega de la placa de bienvenida con la foto de perfil autorizada, comunicaciones del evento, soporte y activación de Cuenta DNX.",
    },
    {
      title: "Conservación",
      body: "Los datos se conservan el tiempo necesario para la edición, obligaciones legales aplicables y operación de la cuenta mientras permanezca activa.",
    },
    {
      title: "Derechos",
      body: "Podés solicitar acceso, rectificación o baja contactando a Clickatón por los canales oficiales, sujeto a obligaciones legales de conservación.",
    },
  ],
} as const;
