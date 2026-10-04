// app/actions/course-classroom.ts
"use server";

import { reenviarEnlaces } from "@/lib/course-classroom/grant";

const MENSAJE =
  "Si ese correo tiene cursos vigentes, te mandamos un enlace nuevo. El anterior deja de funcionar.";

/** Siempre el mismo mensaje: no le dice a nadie si un correo compró algo o no. */
export async function pedirEnlaceDelAula(
  _prev: { mensaje: string | null },
  formData: FormData,
): Promise<{ mensaje: string | null }> {
  const email = formData.get("email")?.toString() ?? "";
  try {
    await reenviarEnlaces(email);
  } catch (error) {
    console.error("[fotoffice][cursos] falló el reenvío del enlace del aula", { error });
  }
  return { mensaje: MENSAJE };
}
