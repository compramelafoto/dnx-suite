import type { PortfolioHiddenReason } from "./visibility";

export type HiddenReasonMessage = {
  title: string;
  detail: string;
  action: { label: string; href: string } | null;
};

/**
 * Qué lee la persona cuando su portfolio no está al aire.
 *
 * Tres reglas de escritura:
 *
 * 1. **Nunca desaparecer en silencio.** Ver la propia obra fuera del sitio sin explicación es
 *    peor que la causa.
 * 2. **La deuda se informa sin acusar.** La migración del historial de pagos está incompleta
 *    —hay gente al día que figura debiendo—, así que el texto dice "figurás con" y ofrece la
 *    salida humana, no una acusación.
 * 3. **Ninguna palabra fija para nombrar a la persona.** Cada institución elige la suya en
 *    Configuración → Palabras, así que estos textos hablan en segunda persona y no dicen
 *    "socio" en ningún lado.
 */
const MENSAJES: Record<PortfolioHiddenReason, HiddenReasonMessage> = {
  MODULE_DISABLED: {
    title: "Los portfolios no están habilitados",
    detail: "Tu institución todavía no activó esta sección. Lo que cargues queda guardado.",
    action: null,
  },
  HIDDEN_BY_ADMIN: {
    title: "Tu portfolio fue bajado del sitio",
    detail:
      "La administración lo sacó de la web. Tus fotos siguen guardadas. Escribile a la Secretaría para saber por qué.",
    action: null,
  },
  MEMBER_NOT_ACTIVE: {
    title: "Tu portfolio no se está mostrando",
    detail:
      "Tu ficha no figura activa en este momento. Tus fotos siguen guardadas y vuelven a verse apenas se regularice.",
    action: null,
  },
  NO_CONSENT: {
    title: "Falta que autorices la publicación",
    detail:
      "Para que tu portfolio aparezca en el sitio necesitamos que autorices publicar tu nombre y tus datos profesionales. Lo podés dar de baja cuando quieras.",
    action: { label: "Ir a mi perfil", href: "/portal/perfil" },
  },
  NO_PHOTOS: {
    title: "Todavía no subiste ninguna foto",
    detail: "Subí al menos una para que tu portfolio pueda publicarse.",
    action: null,
  },
  NOT_PUBLISHED_BY_MEMBER: {
    title: "Tu portfolio está listo, pero sin publicar",
    detail: "Tenés todo en orden. Prendé el interruptor de abajo para que se vea en el sitio.",
    action: null,
  },
  OVERDUE_DUES: {
    title: "Tu portfolio no se está mostrando",
    detail:
      "Figurás con cuotas vencidas. Si ya las pagaste, avisale a la Secretaría: puede publicarlo igual sin que tengas que hacer nada más.",
    action: { label: "Ver mis cuotas", href: "/portal/cuotas" },
  },
};

export function hiddenReasonMessage(reason: PortfolioHiddenReason): HiddenReasonMessage {
  return MENSAJES[reason];
}
