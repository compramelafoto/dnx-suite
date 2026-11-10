"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { revocarConexionDelUsuario } from "@/lib/fotoffice-conexion/servicio";

const RUTA = "/fotografo/configuracion/apps-conectadas";

/** «Revocar»: corta el acceso de una app. Sólo revoca conexiones del usuario de la sesión. */
export async function revocarConexionAction(formData: FormData) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) redirect(`/login?redirect=${encodeURIComponent(RUTA)}`);

  const id = formData.get("id");
  const ok = typeof id === "string" && (await revocarConexionDelUsuario(user.id, id));
  revalidatePath(RUTA);
  redirect(ok ? `${RUTA}?revocada=1` : `${RUTA}?error=1`);
}
