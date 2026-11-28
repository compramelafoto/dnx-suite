"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { resolverAcceso } from "@/lib/access/acceso";
import type { CtxBandeja } from "@/lib/bandeja/acceso";
import { borrarRespuesta, guardarRespuesta } from "@/lib/bandeja/respuestas-rapidas";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";

// El workspace y el usuario salen de la sesión; los permisos se vuelven a mirar en `lib/bandeja/respuestas-rapidas`.
async function contexto(): Promise<CtxBandeja> {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  const acceso = await resolverAcceso(user.id, workspace.id);
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role, acceso };
}

const RUTA = "/workspace/configuracion/whatsapp/respuestas-rapidas";

export async function guardarRespuestaAction(datos: { id?: string; atajo: string; titulo: string; texto: string }) {
  const r = await guardarRespuesta(await contexto(), typeof datos === "object" && datos !== null ? datos : {});
  if (r.ok) revalidatePath(RUTA);
  return r;
}

export async function borrarRespuestaAction(id: string) {
  const r = await borrarRespuesta(await contexto(), id);
  if (r.ok) revalidatePath(RUTA);
  return r;
}
