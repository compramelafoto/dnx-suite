"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@repo/db";
import {
  guestbookInput, guestbookProblems, guestbookState, initialEntryStatus, isGuestbookMode, isModerationAction, isTooFast, nextEntryStatus,
} from "@repo/muestras";
import { frenarPorIp, frenarPorMuestra, frenarPorUsuario, ipDeLaPeticion } from "@/lib/limite";
import { getUsuario } from "@/lib/usuario";

export type ResultadoLibro = { ok: true; publicado: boolean } | { ok: false; error: string };

const ID = /^[A-Za-z0-9_-]{1,64}$/;
// A un robot se le contesta como si hubiera salido bien: no aprende qué lo delató.
const COMO_SI_NADA: ResultadoLibro = { ok: true, publicado: false };

/** Comentario del público, sin cuenta (D18–D20). No guarda IP ni nada que identifique. */
export async function dejarComentario(fd: FormData): Promise<ResultadoLibro> {
  const activityId = String(fd.get("muestra") ?? "");
  if (!ID.test(activityId)) return { ok: false, error: "No encontramos esta muestra." };
  if (String(fd.get("sitio") ?? "") !== "") return COMO_SI_NADA;
  if (isTooFast(Number(fd.get("t")), Date.now())) return COMO_SI_NADA;
  if (!frenarPorIp("libro", ipDeLaPeticion(await headers()), activityId).allowed) {
    return { ok: false, error: "Dejaste varios comentarios seguidos. Probá en unos minutos." };
  }
  const crudo = { name: fd.get("nombre"), city: fd.get("ciudad"), comment: fd.get("comentario") };
  const entrada = guestbookInput(crudo);
  const problemas = guestbookProblems(entrada, [crudo.name, crudo.city, crudo.comment]);
  if (problemas.length) return { ok: false, error: problemas.join(" ") };
  const a = await prisma.culturalActivity.findUnique({
    where: { id: activityId },
    select: { id: true, slug: true, reviewStatus: true, type: true, isCancelled: true, guestbookMode: true, endsAt: true },
  });
  if (!a || guestbookState(a, new Date()) !== "OPEN") return { ok: false, error: "El libro de visitas de esta muestra está cerrado." };
  if (!frenarPorMuestra("libro", a.id).allowed) return { ok: false, error: "El libro recibió muchos comentarios en poco tiempo. Probá en un rato." };
  const status = initialEntryStatus(a.guestbookMode);
  await prisma.culturalActivityGuestbookEntry.create({
    data: { activityId: a.id, name: entrada.name, city: entrada.city, comment: entrada.comment, status },
  });
  if (status === "PUBLISHED") {
    revalidatePath(`/m/${a.slug}`);
    revalidatePath(`/m/${a.slug}/libro`);
  }
  return { ok: true, publicado: status === "PUBLISHED" };
}

type Resultado = { ok: true } | { ok: false; error: string };

/** Publicar, ocultar o borrar (definitivo) un comentario. Dueño de la muestra o super admin. */
export async function moderarEntrada(entryId: string, accion: string): Promise<Resultado> {
  const usuario = await getUsuario();
  if (!usuario) return { ok: false, error: "Tu sesión venció. Volvé a ingresar." };
  if (typeof entryId !== "string" || !ID.test(entryId) || !isModerationAction(accion)) return { ok: false, error: "No se puede hacer eso." };
  if (!frenarPorUsuario("moderarLibro", usuario.id).allowed) return { ok: false, error: "Esperá unos minutos y seguí." };
  const e = await prisma.culturalActivityGuestbookEntry.findUnique({
    where: { id: entryId },
    select: { id: true, activity: { select: { id: true, slug: true, proposedByUserId: true } } },
  });
  if (!e || (!usuario.esSuperAdmin && e.activity.proposedByUserId !== usuario.id)) return { ok: false, error: "No encontramos ese comentario." };
  const estado = nextEntryStatus(accion);
  if (estado === null) await prisma.culturalActivityGuestbookEntry.deleteMany({ where: { id: e.id } });
  else await prisma.culturalActivityGuestbookEntry.updateMany({ where: { id: e.id }, data: { status: estado, moderatedAt: new Date(), moderatedByUserId: usuario.id } });
  revalidatePath(`/m/${e.activity.slug}`);
  revalidatePath(`/m/${e.activity.slug}/libro`);
  revalidatePath(`/panel/estadisticas/${e.activity.id}/libro`);
  return { ok: true };
}

/** PUBLISH | REVIEW | OFF. Los pendientes siguen pendientes al pasar a PUBLISH: los decide el organizador. */
export async function cambiarModoLibro(activityId: string, modo: string): Promise<Resultado> {
  const usuario = await getUsuario();
  if (!usuario) return { ok: false, error: "Tu sesión venció. Volvé a ingresar." };
  if (typeof activityId !== "string" || !ID.test(activityId) || !isGuestbookMode(modo)) return { ok: false, error: "No se puede hacer eso." };
  if (!frenarPorUsuario("cambiarModoLibro", usuario.id).allowed) return { ok: false, error: "Esperá unos minutos y seguí." };
  const { count } = await prisma.culturalActivity.updateMany({
    where: { id: activityId, type: "MUESTRA", ...(usuario.esSuperAdmin ? {} : { proposedByUserId: usuario.id }) },
    data: { guestbookMode: modo },
  });
  if (count === 0) return { ok: false, error: "No encontramos esa muestra entre las tuyas." };
  revalidatePath(`/panel/estadisticas/${activityId}/libro`);
  return { ok: true };
}
