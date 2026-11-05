"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";
import { clasesDelCurso, rutaDelCurso, validarVideos } from "@/lib/tutoriales/curso";
import { cursoTutorial } from "@/lib/tutoriales/cursos";
import { guardarVideosDelCurso } from "@/lib/tutoriales/videos";

export type EstadoGuardado = { ok: true; mensaje: string } | { ok: false; mensaje: string } | null;

/** Guarda los links de YouTube de un curso. Solo para administración de plataforma. */
export async function guardarLinksDelCurso(_previo: EstadoGuardado, form: FormData): Promise<EstadoGuardado> {
  const user = await requireAuth();
  if (!(await isFotofficePlatformAdmin(user.id))) return { ok: false, mensaje: "No tenés permiso." };
  const curso = cursoTutorial(String(form.get("curso") ?? ""));
  if (!curso) return { ok: false, mensaje: "Ese curso no existe." };

  const entrada: Record<string, string> = {};
  for (const clase of clasesDelCurso(curso)) entrada[clase.clave] = String(form.get(`clase-${clase.clave}`) ?? "");
  const validado = validarVideos(entrada, clasesDelCurso(curso));
  if ("error" in validado) return { ok: false, mensaje: validado.error };

  await guardarVideosDelCurso(curso, validado.videos);
  revalidatePath(rutaDelCurso(curso));
  revalidatePath("/admin/tutoriales");
  const n = Object.keys(validado.videos).length;
  return { ok: true, mensaje: `Guardado: ${n} ${n === 1 ? "clase publicada" : "clases publicadas"}.` };
}
