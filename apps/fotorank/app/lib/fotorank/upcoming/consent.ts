/**
 * Consentimientos del registro de interés — textos versionados.
 *
 * Regla legal: el consentimiento específico (avisos de ESTE concurso) y el
 * consentimiento general (novedades de FotoRank) son independientes.
 * Ninguna casilla opcional viene premarcada, y participar en otro concurso
 * (Clickatón, Santa Fe en Foco) NO habilita ninguno de los dos.
 */

/**
 * Versión vigente. Cambiar este valor SOLO si cambia el texto: las filas ya
 * registradas conservan la versión que aceptaron y nunca se reescriben.
 */
export const CURRENT_CONSENT_VERSION = "interest-consent-v1-2026-08";

export type ConsentKind = "CONTEST_SPECIFIC" | "GENERAL";

export type ConsentText = {
  version: string;
  kind: ConsentKind;
  /** Obligatorio para registrar el interés. */
  required: boolean;
  /** Nunca true: las casillas opcionales no se premarcan. */
  defaultChecked: false;
  /** `{{contestTitle}}` se reemplaza al renderizar. */
  template: string;
};

export const CONSENT_TEXTS: Record<ConsentKind, ConsentText> = {
  CONTEST_SPECIFIC: {
    version: CURRENT_CONSENT_VERSION,
    kind: "CONTEST_SPECIFIC",
    required: true,
    defaultChecked: false,
    template:
      "Quiero recibir por correo electrónico información sobre la apertura, fechas y " +
      "novedades de {{contestTitle}}. Puedo cancelar esta notificación en cualquier momento.",
  },
  GENERAL: {
    version: CURRENT_CONSENT_VERSION,
    kind: "GENERAL",
    required: false,
    defaultChecked: false,
    template:
      "Quiero recibir información sobre próximos concursos, eventos y oportunidades de FotoRank.",
  },
};

export function renderConsentText(kind: ConsentKind, contestTitle: string): string {
  return CONSENT_TEXTS[kind].template.split("{{contestTitle}}").join(contestTitle);
}

/** Copy del modal de confirmación. Versionado junto con los consentimientos. */
export const INTEREST_MODAL_COPY = {
  version: CURRENT_CONSENT_VERSION,
  title: "¿Querés que te avisemos cuando abra {{contestTitle}}?",
  body:
    "Por registrarte antes del lanzamiento accederás a un precio promocional exclusivo. " +
    "Registrarte no implica ningún pago ni compromiso de participación.",
  confirmLabel: "Sí, quiero que me avisen",
  successMessage:
    "¡Listo! Te avisaremos cuando se abra el concurso. Además, tendrás acceso al precio " +
    "promocional para interesados durante el período establecido.",
  /** Cuando el registro ocurre fuera de la ventana del beneficio. */
  successMessageWithoutBenefit:
    "¡Listo! Te avisaremos cuando se abra el concurso. El período de acceso al precio " +
    "promocional para interesados ya finalizó.",
  cancelLabel: "Ahora no",
} as const;

export function renderModalTitle(contestTitle: string): string {
  return INTEREST_MODAL_COPY.title.split("{{contestTitle}}").join(contestTitle);
}

export type ConsentInput = {
  contestSpecificOptIn: boolean;
  generalOptIn: boolean;
};

export type ConsentValidation =
  | { ok: true; version: string }
  | { ok: false; error: string };

/**
 * El consentimiento específico es condición para registrar interés.
 * El general es estrictamente opcional y no puede inferirse del específico.
 */
export function validateConsent(input: ConsentInput): ConsentValidation {
  if (!input.contestSpecificOptIn) {
    return {
      ok: false,
      error:
        "Para registrar tu interés necesitamos tu consentimiento para enviarte avisos de este concurso.",
    };
  }
  return { ok: true, version: CURRENT_CONSENT_VERSION };
}
