"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { cambiarActivoProveedor, guardarProveedor } from "@/lib/proveedores/repositorio";

const RUTA = "/workspace/configuracion/proveedores";

async function contexto() {
  const { workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) redirect(`${RUTA}?error=${encodeURIComponent("Sólo el dueño o un administrador pueden cambiar los proveedores.")}`);
  return workspace.id;
}

export async function guardarProveedorAction(formData: FormData): Promise<void> {
  const workspaceId = await contexto();
  const id = String(formData.get("id") ?? "").trim() || null;
  const r = await guardarProveedor(workspaceId, id, {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
  });
  revalidatePath(RUTA);
  redirect(r.ok ? `${RUTA}?ok=1` : `${RUTA}?error=${encodeURIComponent(r.error)}`);
}

export async function cambiarActivoProveedorAction(formData: FormData): Promise<void> {
  const workspaceId = await contexto();
  const id = String(formData.get("id") ?? "");
  const activo = formData.get("active") === "1";
  await cambiarActivoProveedor(workspaceId, id, activo);
  revalidatePath(RUTA);
  redirect(RUTA);
}
