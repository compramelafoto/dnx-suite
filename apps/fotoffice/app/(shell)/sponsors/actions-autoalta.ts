"use server";

import { revalidatePath } from "next/cache";
import { requireSponsorsManager } from "@/lib/sponsors/access";
import { SponsorsError } from "@/lib/sponsors/repository";
import { createSelfSignupLink, inviteNewSponsor } from "@/lib/sponsors/self-signup";

/**
 * Los enlaces de autoalta de sponsors.
 *
 * Viven aparte de `actions.ts` porque devuelven el enlace en vez de redirigir: el token crudo
 * se muestra una sola vez y no puede viajar en la dirección de la página, donde quedaría en el
 * historial. Cada una lleva su propio control de acceso.
 */

export type EnlaceState = {
  error: string | null;
  url: string | null;
  partnerId: string | null;
  expiresAt: string | null;
};

function mensaje(error: unknown): string {
  if (error instanceof SponsorsError) return error.message;
  console.error("[fotoffice][sponsors] no se pudo generar el enlace de autoalta", {
    detalle: error instanceof Error ? error.message : String(error),
  });
  return "No se pudo generar el enlace. Probá de nuevo en un rato.";
}

/** Enlace para un sponsor que ya está en la institución. */
export async function generarEnlaceAutoaltaAction(
  partnerId: string,
  _prev: EnlaceState,
  _formData: FormData,
): Promise<EnlaceState> {
  const { workspace } = await requireSponsorsManager();
  try {
    const enlace = await createSelfSignupLink({ workspaceId: workspace.id, partnerId });
    revalidatePath(`/sponsors/${partnerId}`);
    return { error: null, url: enlace.url, partnerId, expiresAt: enlace.expiresAt.toISOString() };
  } catch (error) {
    return { error: mensaje(error), url: null, partnerId, expiresAt: null };
  }
}

/** Sponsor nuevo: se crea con su nombre y se devuelve el enlace para que cargue lo demás. */
export async function invitarSponsorAction(_prev: EnlaceState, formData: FormData): Promise<EnlaceState> {
  const { workspace } = await requireSponsorsManager();
  const name = formData.get("name")?.toString() ?? "";
  try {
    const r = await inviteNewSponsor({ workspaceId: workspace.id, name });
    revalidatePath("/sponsors");
    return { error: null, url: r.url, partnerId: r.partnerId, expiresAt: r.expiresAt.toISOString() };
  } catch (error) {
    return { error: mensaje(error), url: null, partnerId: null, expiresAt: null };
  }
}
