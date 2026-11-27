"use server";

import { isSuperAdmin } from "@repo/auth-guards";
import { notFound, redirect } from "next/navigation";
import { getPortalUser } from "@/lib/guards";
import { findAccountByEmail } from "@/lib/usuarios/bloqueo";

/**
 * Busca una cuenta por correo y vuelve con su número en la URL (`?usuario=`). El correo viaja en
 * el cuerpo del formulario, nunca en la URL (no queda en el historial ni en los registros).
 */
export async function buscarCuenta(formData: FormData) {
  const user = await getPortalUser();
  if (!user || !(await isSuperAdmin(user))) notFound();
  const email = formData.get("email");
  const cuenta = await findAccountByEmail(typeof email === "string" ? email : "");
  redirect(cuenta ? `/admin/usuarios?usuario=${cuenta.id}` : "/admin/usuarios?buscar=sin-resultado");
}
