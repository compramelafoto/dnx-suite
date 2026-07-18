import { foldTextForIntent } from "../../intent/fold-text.js";
import type { ConversationRole } from "./conversation-role.js";

export type RoleSignal =
  | { action: "ENTER"; role: "CLIENT" }
  | { action: "EXIT"; role: "OWNER" }
  | { action: "NONE" };

const ENTER_CLIENT_PATTERNS: RegExp[] = [
  /\bsimulemos?\b.*\bcliente/,
  /\bquiero probar\b.*\bcliente/,
  /\bprobar\b.*\bconversaci[oó]n\b.*\bcliente/,
  /\bactua(?:r|á|a)?\b.*\bcomo\b.*\bcliente/,
  /\bcomo si (?:fueras|fuese|eras)\b.*\bcliente/,
  /\bquiero ver c[oó]mo responder[ií]as\b.*\bcliente/,
  /\bhablemos\b.*\bcomo si\b.*\bcliente/,
  /\bcomo si yo (?:fuera|fuese)\b.*\bcliente/,
  /\bentr[aá]\b.*\bmodo cliente\b/,
  /\bmodo cliente\b/,
  /\bsimulaci[oó]n\b.*\bcliente/,
  /\bconversaci[oó]n con un cliente\b/,
];

/** Salidas explícitas (siempre). "ya está" / "listo" solo si ya estamos en CLIENT. */
const EXIT_OWNER_PATTERNS: RegExp[] = [
  /\bterminemos?\b.*\bsimulaci[oó]n\b/,
  /\bterminar\b.*\bsimulaci[oó]n\b/,
  /\bvolv[eé]\b.*\bmodo normal\b/,
  /\bmodo normal\b/,
  /\bvolv[eé]\b.*\bpropietario\b/,
  /\bhablar?\b.*\bcomo propietario\b/,
  /\bmodo propietario\b/,
  /\bsalir\b.*\bsimulaci[oó]n\b/,
  /\bfin de la simulaci[oó]n\b/,
];

const EXIT_SOFT_WHEN_CLIENT: RegExp[] = [/^ya est[aá]\.?$/, /^listo\.?$/];

/**
 * Detecta cambio de rol por lenguaje natural.
 * No usa comandos /modo_*.
 */
export function detectRoleSignal(
  text: string,
  currentRole: ConversationRole = "OWNER",
): RoleSignal {
  const folded = foldTextForIntent(text);
  if (!folded) return { action: "NONE" };

  for (const re of EXIT_OWNER_PATTERNS) {
    if (re.test(folded)) {
      return { action: "EXIT", role: "OWNER" };
    }
  }

  if (currentRole === "CLIENT") {
    for (const re of EXIT_SOFT_WHEN_CLIENT) {
      if (re.test(folded)) {
        return { action: "EXIT", role: "OWNER" };
      }
    }
  }

  for (const re of ENTER_CLIENT_PATTERNS) {
    if (re.test(folded)) {
      return { action: "ENTER", role: "CLIENT" };
    }
  }

  return { action: "NONE" };
}

export function isRoleSwitchSignal(
  text: string,
  currentRole: ConversationRole = "OWNER",
): boolean {
  return detectRoleSignal(text, currentRole).action !== "NONE";
}

export function targetRoleFromSignal(
  signal: RoleSignal,
): ConversationRole | undefined {
  if (signal.action === "ENTER") return signal.role;
  if (signal.action === "EXIT") return signal.role;
  return undefined;
}
