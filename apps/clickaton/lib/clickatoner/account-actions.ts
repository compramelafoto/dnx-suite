"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { setOptOut } from "./repository";

/**
 * "No quiero aparecer como Clickatoner de la semana" (y deshacerlo), desde Mi cuenta.
 *
 * La persona es el email de la cuenta: es el mismo con el que se inscribió, y así se la une entre
 * ediciones. Salir corta en el acto la portada, su página y sus fotos públicas.
 */
export async function setClickatonerOptOutAction(formData: FormData): Promise<void> {
  const user = await getClickatonAuthUser();
  if (!user) redirect("/login?next=%2Fmi-cuenta");
  const optOut = formData.get("optOut") === "1";
  await setOptOut({ email: user.email, userId: user.id, optOut });
  revalidatePath("/mi-cuenta");
  revalidatePath("/");
  redirect("/mi-cuenta#clickatoner");
}
