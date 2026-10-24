"use server";

import { prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { validarFechaNacimiento } from "./domain/fecha-nacimiento";

/**
 * "Mi fecha de nacimiento", desde Mi cuenta.
 *
 * Quien se inscribió antes del 25/09/2026 nunca la cargó: el formulario no la pedía. Se guarda
 * en todas sus inscripciones (la persona es el email, igual que en Personas y en el Clickatoner)
 * y en su usuario, para que la próxima inscripción y el panel la lean de cualquier lado.
 */
export async function guardarFechaNacimientoAction(formData: FormData): Promise<void> {
  const user = await getClickatonAuthUser();
  if (!user) redirect("/login?next=%2Fmi-cuenta");

  const resultado = validarFechaNacimiento(String(formData.get("birthDate") ?? ""));
  if (!resultado.ok) {
    redirect(`/mi-cuenta?nacimientoError=${encodeURIComponent(resultado.error)}#nacimiento`);
  }

  await prisma.$transaction([
    prisma.clickatonRegistration.updateMany({
      where: {
        OR: [{ userId: user.id }, { email: { equals: user.email, mode: "insensitive" } }],
      },
      data: { birthDate: resultado.fecha },
    }),
    prisma.user.update({ where: { id: user.id }, data: { birthDate: resultado.fecha } }),
  ]);

  revalidatePath("/mi-cuenta");
  redirect("/mi-cuenta?nacimientoOk=1#nacimiento");
}
