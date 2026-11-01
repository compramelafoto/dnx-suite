"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireRafflesConductor } from "@/lib/raffles/access";
import { parseDedupMode, parsePollOptions } from "@/lib/live-raffles/rules";
import { newPublicCode, newScreenToken, uploadLogoFromForm } from "@/lib/live-raffles/server";

/**
 * Acciones del panel de sorteos en vivo. Mismo permiso que conducir un sorteo de socios:
 * crear, configurar y cargar premios define el resultado.
 */

const LISTA = "/sorteos/en-vivo";
const detalle = (id: string) => `${LISTA}/${id}`;

function conError(destino: string, error: string): never {
  redirect(`${destino}?error=${encodeURIComponent(error)}`);
}

const texto = (form: FormData, k: string, max = 2000) => String(form.get(k) ?? "").trim().slice(0, max);

/** El sorteo, sólo si es de este workspace. El id viene del formulario: no se le cree. */
async function sorteoPropio(form: FormData) {
  const { workspace, user } = await requireRafflesConductor();
  const id = texto(form, "liveRaffleId", 64);
  const sorteo = await prisma.liveRaffle.findFirst({
    where: { id, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!sorteo) conError(LISTA, "No encontramos ese sorteo.");
  return { sorteo, user };
}

export async function createLiveRaffleAction(form: FormData): Promise<void> {
  const { workspace, user } = await requireRafflesConductor();
  const title = texto(form, "title", 160);
  if (!title) conError(LISTA, "Poné un nombre para el sorteo.");

  const sorteo = await prisma.liveRaffle.create({
    data: {
      workspaceId: workspace.id,
      title,
      publicCode: newPublicCode(),
      screenToken: newScreenToken(),
      createdByUserId: user.id,
    },
    select: { id: true },
  });
  revalidatePath(LISTA);
  redirect(detalle(sorteo.id));
}

export async function updateLiveRaffleAction(form: FormData): Promise<void> {
  const { sorteo } = await sorteoPropio(form);
  const title = texto(form, "title", 160);
  if (!title) conError(detalle(sorteo.id), "El nombre no puede quedar vacío.");

  const logo = await uploadLogoFromForm(form, "logo", `sorteo-${sorteo.id}`);
  if (!logo.ok) conError(detalle(sorteo.id), logo.error);

  await prisma.liveRaffle.update({
    where: { id: sorteo.id },
    data: {
      title,
      description: texto(form, "description") || null,
      rulesText: texto(form, "rulesText", 8000) || null,
      dedupMode: parseDedupMode(form.get("dedupMode")),
      oneWinPerPerson: form.get("oneWinPerPerson") === "on",
      registrationOpen: form.get("registrationOpen") === "on",
      ...(logo.url ? { logoUrl: logo.url } : {}),
      ...(form.get("removeLogo") === "on" ? { logoUrl: null } : {}),
    },
  });
  revalidatePath(detalle(sorteo.id));
  redirect(`${detalle(sorteo.id)}?ok=guardado`);
}

export async function addLiveRafflePrizeAction(form: FormData): Promise<void> {
  const { sorteo } = await sorteoPropio(form);
  const title = texto(form, "title", 200);
  if (!title) conError(detalle(sorteo.id), "Poné qué se sortea.");

  const logo = await uploadLogoFromForm(form, "sponsorLogo", `sorteo-${sorteo.id}`);
  if (!logo.ok) conError(detalle(sorteo.id), logo.error);

  const ultimo = await prisma.liveRafflePrize.aggregate({
    where: { liveRaffleId: sorteo.id },
    _max: { order: true },
  });
  await prisma.liveRafflePrize.create({
    data: {
      liveRaffleId: sorteo.id,
      order: (ultimo._max.order ?? 0) + 1,
      title,
      sponsorName: texto(form, "sponsorName", 160) || null,
      sponsorLogoUrl: logo.url ?? null,
    },
  });
  revalidatePath(detalle(sorteo.id));
  redirect(`${detalle(sorteo.id)}?ok=premio#premios`);
}

export async function deleteLiveRafflePrizeAction(form: FormData): Promise<void> {
  const { sorteo } = await sorteoPropio(form);
  await prisma.liveRafflePrize.deleteMany({
    where: { id: texto(form, "prizeId", 64), liveRaffleId: sorteo.id },
  });
  revalidatePath(detalle(sorteo.id));
  redirect(`${detalle(sorteo.id)}#premios`);
}

/** Deshacer el ganador de un premio (por ejemplo, después de un ensayo). */
export async function resetLiveRafflePrizeAction(form: FormData): Promise<void> {
  const { sorteo } = await sorteoPropio(form);
  await prisma.liveRafflePrize.updateMany({
    where: { id: texto(form, "prizeId", 64), liveRaffleId: sorteo.id },
    data: { winnerEntrantId: null, drawnAt: null, absentEntrantIds: [] },
  });
  revalidatePath(detalle(sorteo.id));
  redirect(`${detalle(sorteo.id)}#premios`);
}

export async function addLiveRafflePollAction(form: FormData): Promise<void> {
  const { sorteo } = await sorteoPropio(form);
  const question = texto(form, "question", 300);
  const options = parsePollOptions(texto(form, "options", 4000));
  if (!question) conError(detalle(sorteo.id), "Escribí la pregunta.");
  if (options.length < 2) conError(detalle(sorteo.id), "Una encuesta necesita al menos dos opciones.");

  const ultimo = await prisma.liveRafflePoll.aggregate({
    where: { liveRaffleId: sorteo.id },
    _max: { order: true },
  });
  await prisma.liveRafflePoll.create({
    data: { liveRaffleId: sorteo.id, order: (ultimo._max.order ?? 0) + 1, question, options },
  });
  revalidatePath(detalle(sorteo.id));
  redirect(`${detalle(sorteo.id)}?ok=encuesta#encuestas`);
}

export async function toggleLiveRafflePollAction(form: FormData): Promise<void> {
  const { sorteo } = await sorteoPropio(form);
  await prisma.liveRafflePoll.updateMany({
    where: { id: texto(form, "pollId", 64), liveRaffleId: sorteo.id },
    data: { isOpen: form.get("isOpen") === "true" },
  });
  revalidatePath(detalle(sorteo.id));
  redirect(`${detalle(sorteo.id)}#encuestas`);
}

export async function deleteLiveRafflePollAction(form: FormData): Promise<void> {
  const { sorteo } = await sorteoPropio(form);
  await prisma.liveRafflePoll.deleteMany({
    where: { id: texto(form, "pollId", 64), liveRaffleId: sorteo.id },
  });
  revalidatePath(detalle(sorteo.id));
  redirect(`${detalle(sorteo.id)}#encuestas`);
}

export async function deleteLiveRaffleEntrantAction(form: FormData): Promise<void> {
  const { sorteo } = await sorteoPropio(form);
  const entrantId = texto(form, "entrantId", 64);
  await prisma.$transaction(async (tx) => {
    // Si había ganado algo, el premio vuelve a quedar sin ganador.
    await tx.liveRafflePrize.updateMany({
      where: { liveRaffleId: sorteo.id, winnerEntrantId: entrantId },
      data: { winnerEntrantId: null, drawnAt: null },
    });
    await tx.liveRaffleEntrant.deleteMany({ where: { id: entrantId, liveRaffleId: sorteo.id } });
  });
  revalidatePath(detalle(sorteo.id));
  redirect(`${detalle(sorteo.id)}#inscriptos`);
}

/** Un enlace de pantalla nuevo: el anterior deja de servir (por si se compartió de más). */
export async function rotateLiveRaffleScreenTokenAction(form: FormData): Promise<void> {
  const { sorteo } = await sorteoPropio(form);
  await prisma.liveRaffle.update({ where: { id: sorteo.id }, data: { screenToken: newScreenToken() } });
  revalidatePath(detalle(sorteo.id));
  redirect(`${detalle(sorteo.id)}?ok=enlace`);
}
