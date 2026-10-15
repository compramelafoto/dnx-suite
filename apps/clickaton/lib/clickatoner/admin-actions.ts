"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import {
  ensureCurrentClickatoner,
  setEditionResultsPublished,
  skipCurrentClickatoner,
} from "./repository";

function volver(aviso: { ok?: string; error?: string }): never {
  redirect(`${adminRoutes.clickatoner}?${new URLSearchParams(aviso as Record<string, string>).toString()}`);
}

function refrescar() {
  revalidatePath(adminRoutes.clickatoner);
  revalidatePath("/");
}

/** Prende o apaga "Resultados publicados" de una edición. */
export async function setEditionResultsPublishedAction(formData: FormData): Promise<void> {
  const admin = await requireClickatonAdmin();
  const editionId = String(formData.get("editionId") ?? "");
  const published = formData.get("published") === "1";
  if (!editionId) volver({ error: "Falta la edición." });
  await setEditionResultsPublished({ editionId, published, userId: admin.id });
  refrescar();
  volver({
    ok: published
      ? "Listo: los resultados de esa edición quedaron publicados. Sus participantes ya entran en la rotación."
      : "Listo: esa edición dejó de tener resultados publicados. Sus participantes y obras ya no se muestran.",
  });
}

/** Elige al clickatoner de esta semana si todavía no hay (la tarea horaria lo hace sola). */
export async function pickClickatonerNowAction(): Promise<void> {
  await requireClickatonAdmin();
  const r = await ensureCurrentClickatoner();
  refrescar();
  volver(r ? { ok: "Listo, ya hay clickatoner de la semana." } : { error: "Todavía no hay nadie para elegir." });
}

/** Saltea al clickatoner de esta semana y elige otro al azar. */
export async function skipClickatonerAction(formData: FormData): Promise<void> {
  const admin = await requireClickatonAdmin();
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const r = await skipCurrentClickatoner({ id, userId: admin.id, reason });
  refrescar();
  if (!r.ok) volver({ error: r.error });
  volver({ ok: "Lo salteamos y elegimos a otra persona para esta semana." });
}
