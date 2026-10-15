"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { anotarseGratis } from "@/lib/course-classroom/beneficio";

export async function anotarmeGratisAction(courseId: string): Promise<void> {
  const user = await requireAuth();
  const r = await anotarseGratis({ userId: user.id, courseId });
  // El aviso lleva sólo un código fijo; la página lo traduce con un mapa propio.
  redirect(r.ok ? "/portal/cursos" : `/portal/cursos?aviso=${encodeURIComponent(r.codigo)}`);
}
