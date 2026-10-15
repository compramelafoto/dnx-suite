"use server";

import { respondConsent } from "@/lib/store/artworks/consent";
import { loadStoreWorkspace } from "@/lib/store/repository";

export type RespondConsentActionResult = { ok: true } | { ok: false; error: string };

const ENLACE_INVALIDO = "Este enlace ya no es válido. Pedile uno nuevo a la institución.";

/**
 * La respuesta del autor desde el enlace del correo. Sin cuenta: el token es la llave. No exige
 * la tienda abierta (retirar una obra tiene que poder hacerse siempre).
 */
export async function respondConsentAction(
  workspaceSlug: unknown,
  token: unknown,
  action: unknown,
): Promise<RespondConsentActionResult> {
  if (typeof workspaceSlug !== "string") return { ok: false, error: ENLACE_INVALIDO };
  const store = await loadStoreWorkspace(workspaceSlug);
  if (!store) return { ok: false, error: ENLACE_INVALIDO };
  const r = await respondConsent(store.workspace.id, token, action);
  if (r.ok) return { ok: true };
  return {
    ok: false,
    error:
      r.reason === "INVALID_LINK"
        ? ENLACE_INVALIDO
        : "Eso ya no se puede hacer: puede que ya hayas respondido. Recargá la página para ver cómo quedó.",
  };
}
