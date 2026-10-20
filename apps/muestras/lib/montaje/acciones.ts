"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import { hangingLayout, hangingPlanProblems, parseHangingPlan } from "@repo/muestras";
import { conPermiso } from "@/lib/equipo/permisos";
import { datosDeCambio } from "@/lib/equipo/registro";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario } from "@/lib/usuario";

export type ResultadoMontaje = { ok: true; avisos: string[] } | { ok: false; errores: string[] };

const NO_EXISTE: ResultadoMontaje = { ok: false, errores: ["No encontramos esa muestra entre las tuyas."] };

/**
 * Guarda el plano entero (D8). Cualquier estado de la muestra (D11): el montaje se prepara antes
 * de publicar. Las obras que no son de esta muestra se descartan al leer.
 */
export async function guardarMontaje(activityId: string, planJson: string): Promise<ResultadoMontaje> {
  const usuario = await getUsuario();
  if (!usuario) return { ok: false, errores: ["Tu sesión venció. Volvé a ingresar."] };
  if (typeof activityId !== "string" || typeof planJson !== "string") return NO_EXISTE;
  if (planJson.length > 200_000) return { ok: false, errores: ["El plano es demasiado grande."] };
  if (!frenarPorUsuario("guardarMontaje", usuario.id).allowed) {
    return { ok: false, errores: ["Guardaste muchas veces seguidas. Esperá unos minutos."] };
  }
  let crudo: unknown;
  try {
    crudo = JSON.parse(planJson);
  } catch {
    return { ok: false, errores: ["No pudimos leer el plano. Recargá la página."] };
  }
  const a = await prisma.culturalActivity.findFirst({
    where: conPermiso({ id: activityId, type: "MUESTRA" }, usuario, "hanging"),
    select: { id: true, works: { select: { id: true } } },
  });
  if (!a) return NO_EXISTE;
  const { plan } = parseHangingPlan(crudo, a.works.map((w) => w.id));
  const problemas = hangingPlanProblems(plan);
  if (problemas.length) return { ok: false, errores: problemas };
  // El plano no sube `editVersion`: no pisa la ficha (D7). Sí deja el registro (D8).
  await prisma.culturalActivity.update({
    where: { id: a.id },
    data: { hangingPlan: plan as unknown as Prisma.InputJsonValue, ...datosDeCambio(usuario.id, "MONTAJE") },
  });
  revalidatePath(`/panel/montaje/${a.id}`);
  return { ok: true, avisos: plan.walls.flatMap((w) => hangingLayout(w, plan.centerHeightCm).warnings.map((x) => `${w.name}: ${x}`)) };
}
