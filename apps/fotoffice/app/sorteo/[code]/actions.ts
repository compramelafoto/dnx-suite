"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, prisma } from "@repo/db";
import { parseDedupMode, parseEntrantForm, parseVote } from "@/lib/live-raffles/rules";
import { drawWinner, entrantCookieName, publicPath, screenPath } from "@/lib/live-raffles/server";

/**
 * Acciones públicas del sorteo en vivo: anotarse y votar (sin cuenta, desde el QR) y sortear
 * (desde la pantalla, con el token del enlace secreto como credencial).
 */

const texto = (form: FormData, k: string, max = 200) => String(form.get(k) ?? "").trim().slice(0, max);

function volver(code: string, params: Record<string, string>): never {
  redirect(`${publicPath(code)}?${new URLSearchParams(params).toString()}`);
}

export async function registerLiveRaffleEntrantAction(form: FormData): Promise<void> {
  const code = texto(form, "code", 32);
  const sorteo = await prisma.liveRaffle.findUnique({
    where: { publicCode: code },
    select: { id: true, dedupMode: true, rulesText: true, registrationOpen: true },
  });
  if (!sorteo) redirect("/");
  if (!sorteo.registrationOpen) volver(code, { error: "La inscripción ya está cerrada." });

  const modo = parseDedupMode(sorteo.dedupMode);
  const parsed = parseEntrantForm(form, modo, Boolean(sorteo.rulesText?.trim()));
  if (!parsed.ok) volver(code, { error: parsed.error });

  let entrantId: string;
  try {
    const creado = await prisma.liveRaffleEntrant.create({
      data: { liveRaffleId: sorteo.id, ...parsed.values },
      select: { id: true },
    });
    entrantId = creado.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const campos = String((error.meta?.target as string[] | string | undefined) ?? "");
      volver(code, {
        error: campos.includes("dni")
          ? "Ya hay alguien anotado con ese DNI. Cada persona participa una sola vez."
          : "Ya hay alguien anotado con ese celular. Cada persona participa una sola vez.",
      });
    }
    throw error;
  }

  (await cookies()).set(entrantCookieName(sorteo.id), entrantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/sorteo",
    maxAge: 60 * 60 * 24 * 60,
  });
  revalidatePath(publicPath(code));
  volver(code, { ok: "inscripto" });
}

export async function voteLiveRafflePollAction(form: FormData): Promise<void> {
  const code = texto(form, "code", 32);
  const sorteo = await prisma.liveRaffle.findUnique({ where: { publicCode: code }, select: { id: true } });
  if (!sorteo) redirect("/");

  const entrantId = (await cookies()).get(entrantCookieName(sorteo.id))?.value ?? "";
  const entrant = entrantId
    ? await prisma.liveRaffleEntrant.findFirst({ where: { id: entrantId, liveRaffleId: sorteo.id }, select: { id: true } })
    : null;
  if (!entrant) volver(code, { error: "Para votar primero tenés que anotarte." });

  const poll = await prisma.liveRafflePoll.findFirst({
    where: { id: texto(form, "pollId", 64), liveRaffleId: sorteo.id },
    select: { id: true, isOpen: true, kind: true, options: true, allowOther: true },
  });
  if (!poll || !poll.isOpen) volver(code, { error: "Esa votación ya está cerrada." });
  const voto = parseVote(form, poll);
  if (!voto.ok) volver(code, { error: voto.error });

  // Un voto por persona y encuesta. Si ya votó, el voto queda como estaba.
  await prisma.liveRaffleVote
    .create({ data: { pollId: poll.id, entrantId: entrant.id, optionIndex: voto.optionIndex, text: voto.text } })
    .catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
      throw error;
    });
  revalidatePath(publicPath(code));
  redirect(`${publicPath(code)}#encuestas`);
}

/**
 * Sortear desde la pantalla del sorteador: un premio de la lista (`prizeId`), el siguiente
 * sorteo sin listado (sin `prizeId`), o rehacer uno cuyo ganador no estaba (`redoRound`).
 */
export async function drawLiveRafflePrizeAction(input: {
  code: string;
  token: string;
  prizeId?: string;
  redoRound?: number;
}): Promise<{ ok: true; winnerId: string; round: number } | { ok: false; error: string }> {
  const sorteo = await prisma.liveRaffle.findUnique({
    where: { publicCode: String(input.code) },
    select: { id: true, screenToken: true },
  });
  if (!sorteo || sorteo.screenToken !== String(input.token)) {
    return { ok: false, error: "El enlace de la pantalla ya no es válido. Pedí uno nuevo." };
  }
  const redo = Number(input.redoRound);
  const resultado = await drawWinner({
    liveRaffleId: sorteo.id,
    prizeId: input.prizeId ? String(input.prizeId) : undefined,
    redoRound: Number.isInteger(redo) && redo > 0 ? redo : undefined,
  });
  revalidatePath(screenPath(input.code, input.token).split("?")[0]);
  return resultado;
}

/** Borrar todos los resultados desde la pantalla (por ejemplo, después de un ensayo). */
export async function resetLiveRaffleResultsAction(input: {
  code: string;
  token: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sorteo = await prisma.liveRaffle.findUnique({
    where: { publicCode: String(input.code) },
    select: { id: true, screenToken: true },
  });
  if (!sorteo || sorteo.screenToken !== String(input.token)) {
    return { ok: false, error: "El enlace de la pantalla ya no es válido. Pedí uno nuevo." };
  }
  // Sólo los sorteos: inscriptos, premios y encuestas quedan como estaban.
  await prisma.liveRaffleDraw.deleteMany({ where: { liveRaffleId: sorteo.id } });
  revalidatePath(screenPath(input.code, input.token).split("?")[0]);
  return { ok: true };
}
