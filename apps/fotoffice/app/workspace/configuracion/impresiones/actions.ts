"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { guardarAjustes, guardarTamanos } from "@/lib/impresiones/configuracion-servidor";

const RUTA = "/workspace/configuracion/impresiones";

async function contexto() {
  const { workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) redirect(`${RUTA}?error=${encodeURIComponent("Sólo el dueño o un administrador pueden cambiar las impresiones.")}`);
  return workspace.id;
}

export async function guardarAjustesAction(formData: FormData): Promise<void> {
  const workspaceId = await contexto();
  const r = await guardarAjustes(workspaceId, {
    testMode: formData.get("testMode") === "on",
    paperGlossy: formData.get("paperGlossy") === "on",
    paperMatte: formData.get("paperMatte") === "on",
    circuitId: String(formData.get("circuitId") ?? ""),
    shippingEnabled: formData.get("shippingEnabled") === "on",
    shippingBaseArs: String(formData.get("shippingBaseArs") ?? ""),
    shippingPerKmArs: String(formData.get("shippingPerKmArs") ?? ""),
    shippingMaxKm: String(formData.get("shippingMaxKm") ?? ""),
    depositPct: String(formData.get("depositPct") ?? ""),
  });
  revalidatePath(RUTA);
  redirect(r.ok ? `${RUTA}?ok=1` : `${RUTA}?error=${encodeURIComponent(r.error)}`);
}

export async function guardarTamanosAction(filas: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const workspaceId = await contexto();
  const r = await guardarTamanos(workspaceId, filas);
  revalidatePath(RUTA);
  return r;
}
