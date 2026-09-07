import type { RenderedEmailSignature } from "@repo/communications/signature";

/**
 * Los emails del circuito de asociación, de punta a punta.
 *
 * El formulario público le prometía a la persona "te avisamos por email" y nadie le avisaba
 * nada: ni que la solicitud había llegado, ni que la habían aceptado, ni por qué la habían
 * rechazado. El motivo del rechazo se guardaba en la base y moría ahí.
 *
 * Funciones PURAS: sin red, sin base y sin variables de entorno. Se pueden verificar el
 * vocabulario, los importes y los plazos sin enviar un solo correo, que es la única forma de
 * probar textos que van a leer personas que no conocen el sistema.
 *
 * Reglas que valen para todos:
 * - Le escribe una institución a una persona. No aparecen "workspace", "solicitud PENDIENTE"
 *   ni ningún otro término interno.
 * - El asunto viaja como encabezado: no se escapa, o el destinatario vería `&amp;`.
 * - El texto plano se arma aparte y nunca se deriva del HTML.
 * - La firma institucional entra una sola vez, al final.
 */

export type EmailBody = { subject: string; html: string; text: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Composition = {
  subject: string;
  /** Nombre de pila de quien recibe. Sin él el email arranca directo por el cuerpo. */
  greetingName?: string | null;
  paragraphs: string[];
  cta?: { label: string; url: string } | null;
  /** Aclaraciones al pie, en letra chica. */
  notes?: string[];
  signature: RenderedEmailSignature | null;
};

/**
 * Arma el HTML y el texto plano de un email.
 *
 * Exportada porque el aviso de las recomendaciones (`recommendation-emails.ts`) tiene que
 * salir con exactamente la misma forma: mismo saludo, misma firma, mismo pie. Duplicar el
 * armado sería la vía más corta a dos estilos de correo distintos saliendo de la misma
 * institución.
 *
 * Centralizado a propósito: siete emails escritos a mano cada uno por su lado terminan con
 * siete botones de colores distintos y tres formas de despedirse.
 */
export function compose(input: Composition): EmailBody {
  const saludo = input.greetingName?.trim() ? `Hola ${input.greetingName.trim()},` : null;

  const htmlParrafos = input.paragraphs.map((p) => `  <p>${escapeHtml(p)}</p>`).join("\n");

  const htmlCta = input.cta
    ? `\n  <p style="margin:24px 0;">
    <a href="${escapeHtml(input.cta.url)}" style="background:#1d4ed8;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">${escapeHtml(input.cta.label)}</a>
  </p>
  <p style="font-size:13px;color:#6b7280;">Si el botón no funciona, copiá y pegá esta dirección en tu navegador:<br>${escapeHtml(input.cta.url)}</p>`
    : "";

  const htmlNotas = (input.notes ?? [])
    .map((n) => `\n  <p style="font-size:13px;color:#6b7280;">${escapeHtml(n)}</p>`)
    .join("");

  const htmlFirma = input.signature
    ? `\n  <div id="fo-signature" style="margin-top:16px;">${input.signature.html}</div>`
    : "";

  const html = `
<div>
${saludo ? `  <p>${escapeHtml(saludo)}</p>\n` : ""}${htmlParrafos}${htmlCta}${htmlNotas}${htmlFirma}
</div>
`.trim();

  const text = [
    ...(saludo ? [saludo, ""] : []),
    input.paragraphs.join("\n\n"),
    ...(input.cta ? ["", `${input.cta.label}:`, input.cta.url] : []),
    ...((input.notes ?? []).length ? ["", (input.notes ?? []).join("\n")] : []),
    ...(input.signature ? ["", input.signature.text] : []),
  ].join("\n");

  return { subject: input.subject, html, text };
}

/** Acuse de recibo. Sale apenas se envía el formulario público. */
export function buildApplicationReceivedEmail(input: {
  firstName: string;
  institution: string;
  signature: RenderedEmailSignature | null;
}): EmailBody {
  return compose({
    subject: `Recibimos tu solicitud para asociarte a ${input.institution}`,
    greetingName: input.firstName,
    paragraphs: [
      `Recibimos tu solicitud para asociarte a ${input.institution}. Queda en manos de la Secretaría, que la va a revisar.`,
      "Te vamos a escribir a esta misma dirección con la respuesta, sea cual sea. No hace falta que hagas nada más por ahora.",
    ],
    notes: ["Si no fuiste vos quien completó este formulario, avisanos respondiendo este correo."],
    signature: input.signature,
  });
}

/**
 * Aviso a la Secretaría de que entró una solicitud.
 *
 * Sin esto, la bandeja solo se descubre entrando a mirarla: alguien podía asociarse un lunes
 * y esperar tres semanas porque nadie abrió la pantalla.
 *
 * No lleva los datos de la persona más allá del nombre: van a una casilla institucional que
 * puede leer más de uno, y para verlos está la bandeja, que exige permiso.
 */
export function buildApplicationAlertEmail(input: {
  applicantName: string;
  institution: string;
  inboxUrl: string;
  signature: RenderedEmailSignature | null;
}): EmailBody {
  return compose({
    // La institución va adelante: una misma casilla puede atender a más de una.
    subject: `${input.institution}: nueva solicitud de ${input.applicantName}`,
    paragraphs: [
      `${input.applicantName} pidió asociarse a ${input.institution}.`,
      "La solicitud está esperando resolución en la bandeja de solicitudes. Al aprobarla se crea el socio, se le asigna número y se generan sus cuotas de ingreso.",
    ],
    cta: { label: "Ver la solicitud", url: input.inboxUrl },
    signature: input.signature,
  });
}

/**
 * Aprobación.
 *
 * Es el email que más trabajo hace del circuito: comunica la aceptación, dice exactamente
 * cuánto hay que pagar y hasta cuándo, y trae el enlace con el que la persona activa su cuenta
 * —sin el cual no tendría por dónde pagar—. Los tres datos van juntos porque separarlos
 * obligaría a la persona a esperar un segundo correo que nunca fue parte del circuito.
 */
export function buildApplicationApprovedEmail(input: {
  firstName: string;
  institution: string;
  memberNumber: string;
  /** Enlace para activar la cuenta del portal. */
  activationUrl: string;
  /** Total a pagar, ya formateado. */
  totalLabel: string;
  /** Cuántas cuotas de ingreso se generaron. */
  duesCount: number;
  /** Fecha límite, legible. */
  deadlineLabel: string;
  /** Si además pagó la credencial impresa al asociarse. */
  includesPrintedCard: boolean;
  /** Plazo del enlace de activación, en palabras. */
  activationTtlLabel: string;
  signature: RenderedEmailSignature | null;
}): EmailBody {
  const cuotas =
    input.duesCount === 1 ? "tu primera cuota" : `tus primeras ${input.duesCount} cuotas`;
  const detalle = input.includesPrintedCard
    ? `${cuotas} y la credencial impresa que pediste`
    : cuotas;

  return compose({
    subject: `Tu solicitud fue aprobada — ${input.institution}`,
    greetingName: input.firstName,
    paragraphs: [
      `${input.institution} aprobó tu solicitud. Tu número de socio es el ${input.memberNumber}.`,
      `Para completar tu ingreso queda el pago de ${detalle}: ${input.totalLabel} en total.`,
      `Activá tu cuenta con el botón de acá abajo y vas a poder pagar desde ahí. Tenés tiempo hasta el ${input.deadlineLabel}.`,
    ],
    cta: { label: "Activar mi cuenta y pagar", url: input.activationUrl },
    notes: [
      `El enlace vence en ${input.activationTtlLabel}. Si se te pasa, escribinos y te mandamos uno nuevo.`,
      `Si el ${input.deadlineLabel} no registramos el pago, el ingreso queda sin efecto y habría que empezar de nuevo.`,
    ],
    signature: input.signature,
  });
}

/**
 * Rechazo.
 *
 * El motivo es obligatorio al rechazar, y este email es el único lugar donde esa obligación
 * tiene sentido: exigirle a la Secretaría que escriba un motivo que nadie va a leer es
 * papeleo. Se transcribe tal cual, sin suavizarlo ni interpretarlo.
 */
export function buildApplicationRejectedEmail(input: {
  firstName: string;
  institution: string;
  reason: string;
  signature: RenderedEmailSignature | null;
}): EmailBody {
  return compose({
    subject: `Sobre tu solicitud para asociarte a ${input.institution}`,
    greetingName: input.firstName,
    paragraphs: [
      `Revisamos tu solicitud para asociarte a ${input.institution} y por ahora no podemos darle curso.`,
      `El motivo es: ${input.reason}`,
      "Si creés que hubo un error o querés presentarla de nuevo con esa corrección, respondé este correo y lo vemos.",
    ],
    signature: input.signature,
  });
}

/** Recordatorio: el plazo se está por cumplir y el pago no llegó. */
export function buildApplicationReminderEmail(input: {
  firstName: string;
  institution: string;
  totalLabel: string;
  daysLeft: number;
  deadlineLabel: string;
  /**
   * A dónde mandarlo. `INVITACION` es para quien todavía no activó su cuenta —lleva un enlace
   * nuevo, porque el de la aprobación ya venció—; `PORTAL` para quien ya la tiene y solo
   * necesita entrar a pagar.
   */
  access: { kind: "INVITACION" | "PORTAL"; url: string };
  signature: RenderedEmailSignature | null;
}): EmailBody {
  const plazo =
    input.daysLeft === 1 ? "Te queda un día" : `Te quedan ${input.daysLeft} días`;

  return compose({
    subject: `${plazo} para completar tu ingreso a ${input.institution}`,
    greetingName: input.firstName,
    paragraphs: [
      `Tu solicitud para asociarte a ${input.institution} está aprobada, pero todavía no registramos el pago de tu ingreso: ${input.totalLabel}.`,
      `El plazo vence el ${input.deadlineLabel}. Si para esa fecha no llegó el pago, el ingreso queda sin efecto.`,
      input.access.kind === "INVITACION"
        ? "Acá abajo tenés un enlace nuevo para activar tu cuenta y pagar."
        : "Entrá a tu cuenta y vas a poder pagarlo ahí mismo.",
    ],
    cta: {
      label: input.access.kind === "INVITACION" ? "Activar mi cuenta y pagar" : "Pagar mi ingreso",
      url: input.access.url,
    },
    notes: ["Si ya lo pagaste en estos días, ignorá este mensaje."],
    signature: input.signature,
  });
}

/**
 * Vencimiento.
 *
 * Se le dice con todas las letras que quedó sin efecto y cómo volver a intentarlo. Dejar de
 * escribir sería lo peor de los dos mundos: la persona creería que sigue en trámite.
 */
export function buildApplicationExpiredEmail(input: {
  firstName: string;
  institution: string;
  applyUrl: string | null;
  signature: RenderedEmailSignature | null;
}): EmailBody {
  return compose({
    subject: `Tu ingreso a ${input.institution} quedó sin efecto`,
    greetingName: input.firstName,
    paragraphs: [
      `Se cumplió el plazo para pagar tu ingreso a ${input.institution} y no registramos el pago, así que el alta quedó sin efecto. Las cuotas que se te habían generado ya no corren.`,
      "Si querés asociarte igual, podés volver a presentar la solicitud cuando quieras. Y si el pago lo hiciste y algo salió mal, respondé este correo y lo revisamos.",
    ],
    cta: input.applyUrl ? { label: "Volver a solicitar", url: input.applyUrl } : null,
    signature: input.signature,
  });
}

/**
 * Bienvenida: el pago entró y el ingreso quedó cerrado.
 *
 * Es el único email del circuito que confirma que la persona **ya es socia**. Los anteriores
 * hablan de un trámite en curso; este cierra.
 */
export function buildMembershipWelcomeEmail(input: {
  firstName: string;
  institution: string;
  memberNumber: string;
  /** Dirección del carnet digital en el portal. */
  cardUrl: string;
  /** Pidió la credencial impresa y todavía no subió su foto. */
  needsPhotoForPrintedCard: boolean;
  /**
   * Si ya activó su cuenta del portal.
   *
   * Quien pagó en la sede, en efectivo, puede no haberla activado nunca: mandarlo a "ver mi
   * carnet" lo dejaría frente a un login que no sabe pasar. A ese se le dice qué hacer.
   */
  hasAccount: boolean;
  signature: RenderedEmailSignature | null;
}): EmailBody {
  const parrafos = [
    `Registramos tu pago: ya sos socio de ${input.institution}, con el número ${input.memberNumber}.`,
    input.hasAccount
      ? "Tu carnet digital ya está emitido y lo tenés siempre a mano desde tu cuenta. Se renueva solo mientras estés al día."
      : "Tu carnet digital ya está emitido y se renueva solo mientras estés al día. Para verlo necesitás activar tu cuenta: usá el enlace que te enviamos cuando te aprobamos, y si ya venció respondé este correo y te mandamos uno nuevo.",
  ];
  if (input.needsPhotoForPrintedCard) {
    parrafos.push(
      "Nos falta una sola cosa para la credencial impresa que pagaste: tu foto. Subila desde tu perfil y la mandamos a imprimir.",
    );
  }

  return compose({
    subject: `Ya sos socio de ${input.institution} — N° ${input.memberNumber}`,
    greetingName: input.firstName,
    paragraphs: parrafos,
    cta: { label: "Ver mi carnet", url: input.cardUrl },
    signature: input.signature,
  });
}
