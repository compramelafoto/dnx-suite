import { DNX_LOGIN_ORDER, DNX_REGISTER_ORDER } from "./types";

/** Extrae orden de slots desde un contenedor DOM (tests / smoke). */
export function readAuthSlotOrder(root: ParentNode): string[] {
  const nodes = root.querySelectorAll<HTMLElement>("[data-dnx-auth-slot]");
  const seen: string[] = [];
  nodes.forEach((node) => {
    const slot = node.dataset.dnxAuthSlot;
    if (slot && !seen.includes(slot)) seen.push(slot);
  });
  return seen;
}

/**
 * Valida que el orden observado respete el canónico (subsecuencia).
 * Permite omitir slots opcionales (google, create-account, legal…).
 */
export function assertCanonicalSubsequence(
  observed: string[],
  canonical: readonly string[],
): { ok: true } | { ok: false; detail: string } {
  let ci = 0;
  for (const slot of observed) {
    const idx = canonical.indexOf(slot, ci);
    if (idx === -1) {
      // slot desconocido o ya pasado
      if (canonical.includes(slot)) {
        return {
          ok: false,
          detail: `Slot "${slot}" aparece fuera de orden canónico. Observado: ${observed.join(" > ")}`,
        };
      }
      continue;
    }
    ci = idx + 1;
  }
  return { ok: true };
}

export function expectedLoginOrder(): readonly string[] {
  return DNX_LOGIN_ORDER;
}

export function expectedRegisterOrder(): readonly string[] {
  return DNX_REGISTER_ORDER;
}

/** Posición relativa obligatoria: Google después de primary-cta y divider. */
export function assertGoogleAfterPrimary(observed: string[]): { ok: boolean; detail?: string } {
  const google = observed.indexOf("google");
  if (google === -1) return { ok: true };
  const cta = observed.indexOf("primary-cta");
  const divider = observed.indexOf("divider");
  if (cta === -1) {
    return { ok: false, detail: "Google presente sin primary-cta (email login deshabilitado?)" };
  }
  if (google < cta) {
    return { ok: false, detail: "Google aparece antes del CTA principal" };
  }
  if (divider !== -1 && google < divider) {
    return { ok: false, detail: "Google aparece antes del separador" };
  }
  const create = observed.indexOf("create-account");
  if (create !== -1 && google > create) {
    return { ok: false, detail: "Google aparece después de Crear cuenta" };
  }
  return { ok: true };
}
