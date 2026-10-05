"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { anotarseGratis } from "@/lib/course-classroom/beneficio";

export async function anotarmeGratisAction(courseId: string): Promise<void> {
  const user = await requireAuth();
  const r = await anotarseGratis({ userId: user.id, courseId });
  // El aviso es un texto fijo de la regla, nunca un dato personal.
  redirect(r.ok ? "/portal/cursos" : `/portal/cursos?aviso=${encodeURIComponent(r.motivo)}`);
}
