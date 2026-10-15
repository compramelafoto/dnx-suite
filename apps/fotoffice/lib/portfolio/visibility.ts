import { PORTFOLIO_OVERDUE_LIMIT } from "./constants";

/**
 * La única función que decide si el portfolio de alguien está al aire.
 *
 * Por qué una sola y no un chequeo por pantalla: cuando la regla vive repartida, las pantallas
 * se desincronizan y aparece el caso en que el directorio lista a alguien cuya ficha devuelve
 * 404. Es la misma lección que dejaron los avisos de álbum listo.
 *
 * Devuelve el motivo, no un booleano pelado: el portal necesita decirle al socio qué le falta.
 */

export type PortfolioHiddenReason =
  /** El módulo no está habilitado en esta institución. */
  | "MODULE_DISABLED"
  /** La institución lo bajó, con motivo. */
  | "HIDDEN_BY_ADMIN"
  /** Baja o suspensión. Las dos las decide una persona, nunca el sistema. */
  | "MEMBER_NOT_ACTIVE"
  /** No dio el consentimiento para publicarse. */
  | "NO_CONSENT"
  /** Todavía no subió ninguna foto. */
  | "NO_PHOTOS"
  /** Tiene fotos pero no prendió el interruptor. */
  | "NOT_PUBLISHED_BY_MEMBER"
  /** Figura con cargos vencidos por encima del umbral. */
  | "OVERDUE_DUES";

export type PortfolioVisibilityFacts = {
  moduleEnabled: boolean;
  hiddenByAdminAt: Date | null;
  memberStatus: "ACTIVE" | "SUSPENDED" | "INACTIVE";
  directoryOptIn: boolean;
  photoCount: number;
  memberPublished: boolean;
  /** Cargos vencidos con saldo, tal como los cuenta `lib/membership/balance.ts`. */
  overdueCount: number;
  /** El perdón de deuda que puede dar la institución. No saltea ninguna otra condición. */
  adminForcePublish: boolean;
};

export type PortfolioVisibility =
  | { visible: true }
  | { visible: false; reason: PortfolioHiddenReason };

/**
 * El orden de los chequeos es el orden en que se le informan al socio, y no es caprichoso:
 *
 * 1. Primero lo que decidió la institución. Si alguien bajó el portfolio, decirle al socio que
 *    le falta subir una foto es mentirle.
 * 2. Después lo que el socio puede resolver, empezando por lo que desbloquea todo lo demás.
 * 3. La deuda, al final. Es la condición más probable de ser un falso positivo mientras la
 *    migración del historial de pagos siga incompleta, así que sólo se la menciona cuando ya no
 *    queda nada más por corregir.
 */
export function portfolioVisibility(facts: PortfolioVisibilityFacts): PortfolioVisibility {
  if (!facts.moduleEnabled) return { visible: false, reason: "MODULE_DISABLED" };
  if (facts.hiddenByAdminAt !== null) return { visible: false, reason: "HIDDEN_BY_ADMIN" };
  if (facts.memberStatus !== "ACTIVE") return { visible: false, reason: "MEMBER_NOT_ACTIVE" };
  if (!facts.directoryOptIn) return { visible: false, reason: "NO_CONSENT" };
  if (facts.photoCount < 1) return { visible: false, reason: "NO_PHOTOS" };
  if (!facts.memberPublished) return { visible: false, reason: "NOT_PUBLISHED_BY_MEMBER" };
  if (!facts.adminForcePublish && facts.overdueCount >= PORTFOLIO_OVERDUE_LIMIT) {
    return { visible: false, reason: "OVERDUE_DUES" };
  }
  return { visible: true };
}
