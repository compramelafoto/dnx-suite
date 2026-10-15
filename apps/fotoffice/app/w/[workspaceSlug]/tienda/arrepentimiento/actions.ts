"use server";

import { headers } from "next/headers";
import { clientIp } from "@/lib/geocode/rate-limit";
import { REGRET_GENERIC_ERROR, submitRegret } from "@/lib/store/regret";
import { loadStoreWorkspace } from "@/lib/store/repository";

export type RegretFormState = { error: string | null; code: string | null };

function campo(fd: FormData, nombre: string): string {
  const v = fd.get(nombre);
  return typeof v === "string" ? v : "";
}

/**
 * El formulario del botón de arrepentimiento. Pública y sin sesión. No exige la tienda abierta:
 * quien compró puede arrepentirse aunque la tienda se haya cerrado. Las reglas (respuesta
 * genérica, freno por IP, un aviso por día) viven en `lib/store/regret.ts`.
 */
export async function submitRegretAction(
  workspaceSlug: string,
  _prev: RegretFormState,
  fd: FormData,
): Promise<RegretFormState> {
  if (typeof workspaceSlug !== "string" || workspaceSlug.length === 0 || workspaceSlug.length > 100) {
    return { error: REGRET_GENERIC_ERROR, code: null };
  }
  const store = await loadStoreWorkspace(workspaceSlug);
  if (!store) return { error: REGRET_GENERIC_ERROR, code: null };

  const r = await submitRegret({
    workspaceId: store.workspace.id,
    orderNumber: campo(fd, "orderNumber"),
    email: campo(fd, "email"),
    reason: campo(fd, "reason"),
    ip: clientIp(await headers()),
  });
  return r.ok ? { error: null, code: r.code } : { error: r.error, code: null };
}
