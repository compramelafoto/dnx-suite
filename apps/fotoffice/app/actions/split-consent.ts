"use server";

import { revalidatePath } from "next/cache";
import {
  MercadoPagoSplitConsentAdapter,
  createMercadoPagoProviderConfig,
} from "@repo/payments";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import {
  PLATFORM_TOKEN_ENV,
  refreshSplitConsent,
  requestSplitConsent,
  type ConsentProviderPort,
} from "@/lib/payments/connect/consent-invite";
import { sanitizeError } from "@/lib/payments/connect/log";

export type ConsentState = { error: string | null; ok: string | null; inviteUrl?: string | null };

const fail = (error: string): ConsentState => ({ error, ok: null });

/**
 * Adaptador de MercadoPago con el token de **la plataforma**: la invitación al
 * consentimiento la envía quien cobra, no el receptor.
 */
function createProvider(): ConsentProviderPort | null {
  const accessToken = process.env[PLATFORM_TOKEN_ENV]?.trim();
  if (!accessToken) return null;
  return new MercadoPagoSplitConsentAdapter({
    config: createMercadoPagoProviderConfig({ accessToken, environment: "production" }),
  }) as unknown as ConsentProviderPort;
}

async function guard(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay institución activa." };
  if (!(await canManageWorkspaceCollection(user.id, workspace.id))) {
    return { ok: false, error: "Solo el dueño o un administrador puede hacer esto." };
  }
  return { ok: true, workspaceId: workspace.id };
}

/** Pide a MercadoPago la autorización de cobro dividido y devuelve el enlace para otorgarla. */
export async function requestSplitConsentAction(
  _prev: ConsentState | undefined,
  formData: FormData,
): Promise<ConsentState> {
  const g = await guard();
  if (!g.ok) return fail(g.error);

  const provider = createProvider();
  if (!provider) {
    return fail("La plataforma todavía no está configurada para esto. Escribinos.");
  }

  const sellerEmail = formData.get("sellerEmail")?.toString() ?? "";
  try {
    const r = await requestSplitConsent({ workspaceId: g.workspaceId, sellerEmail }, { provider });
    if (!r.ok) return fail(r.error);

    revalidatePath("/workspace/configuracion/cobros");
    return {
      error: null,
      ok:
        r.state === "ACTIVE"
          ? "Tu cuenta ya está autorizada para el cobro dividido."
          : "Listo. Abrí el enlace para autorizar en MercadoPago.",
      inviteUrl: r.inviteUrl,
    };
  } catch (error) {
    console.error("[fotoffice][split-consent] invitación falló", {
      detalle: sanitizeError(error),
    });
    return fail("No se pudo pedir la autorización. Probá de nuevo.");
  }
}

/** Vuelve a consultar el estado: el receptor acepta fuera de la aplicación. */
export async function refreshSplitConsentAction(
  _prev: ConsentState | undefined,
): Promise<ConsentState> {
  const g = await guard();
  if (!g.ok) return fail(g.error);

  const provider = createProvider();
  if (!provider) {
    return fail("La plataforma todavía no está configurada para esto. Escribinos.");
  }

  try {
    const r = await refreshSplitConsent(g.workspaceId, { provider });
    if (!r.ok) return fail(r.error);

    revalidatePath("/workspace/configuracion/cobros");
    return {
      error: null,
      ok:
        r.state === "ACTIVE"
          ? "Autorización confirmada: ya podés cobrar."
          : "Todavía figura sin autorizar en MercadoPago.",
    };
  } catch (error) {
    console.error("[fotoffice][split-consent] consulta falló", {
      detalle: sanitizeError(error),
    });
    return fail("No se pudo consultar el estado. Probá de nuevo.");
  }
}
