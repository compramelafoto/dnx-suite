"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireRafflesAdmin } from "@/lib/raffles/access";
import { parseRaffleForm } from "@/lib/raffles/raffle-form";
import { parsePrizeForm } from "@/lib/raffles/prize-form";
import { announceRaffle } from "@/lib/raffles/announce";
import { sealRaffle } from "@/lib/raffles/seal";
import { resolveRaffle } from "@/lib/raffles/resolve";
import { recordRaffleEvent } from "@/lib/raffles/events";
import { canCancel, canEditPrizes } from "@/lib/raffles/lifecycle";
import type { RaffleStatus } from "@/lib/raffles/constants";

/**
 * Las acciones del panel de sorteos.
 *
 * Todas empiezan por `requireRafflesAdmin()`: el control está acá, en el servidor, y no en
 * que el botón se muestre o no. Ninguna decide si algo es válido — eso lo resuelven los
 * módulos puros, que se pueden probar sin base.
 */

const LISTA = "/sorteos";
const detalle = (id: string) => `${LISTA}/${id}`;

function conError(destino: string, error: string): never {
  redirect(`${destino}?error=${encodeURIComponent(error)}`);
}

/** Nombre legible de quien actúa, para la historia del sorteo. */
function etiquetaActor(user: { name?: string | null; email?: string | null }): string {
  return user.name?.trim() || user.email || "Equipo";
}

export async function createRaffleAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireRafflesAdmin();
  const parsed = parseRaffleForm(formData);
  if (!parsed.ok) conError(`${LISTA}/nuevo`, parsed.error);

  const sorteo = await prisma.raffle.create({
    data: {
      workspaceId: workspace.id,
      title: parsed.values.title,
      description: parsed.values.description,
      entriesCloseAt: parsed.values.entriesCloseAt,
      drawsAt: parsed.values.drawsAt,
      status: "BORRADOR",
      createdByUserId: user.id,
    },
    select: { id: true },
  });
  await recordRaffleEvent(prisma, {
    raffleId: sorteo.id,
    type: "CREADO",
    actorUserId: user.id,
    actorLabel: etiquetaActor(user),
  });

  revalidatePath(LISTA);
  redirect(detalle(sorteo.id));
}

/**
 * Edición del sorteo: sólo en borrador.
 *
 * Después de anunciar, ni las fechas ni los premios se tocan. Un premio agregado después de
 * que la gente vio el anuncio cambia el cálculo del ganador; una fecha corrida deja sin
 * sentido el margen entre el cierre del padrón y el acto.
 */
export async function updateRaffleAction(formData: FormData): Promise<void> {
  const { workspace } = await requireRafflesAdmin();
  const raffleId = String(formData.get("raffleId") ?? "");

  const actual = await prisma.raffle.findFirst({
    where: { id: raffleId, workspaceId: workspace.id },
    select: { id: true, status: true },
  });
  if (!actual) conError(LISTA, "Ese sorteo no existe.");
  if (!canEditPrizes(actual.status as RaffleStatus)) {
    conError(detalle(raffleId), "Un sorteo anunciado ya no se edita.");
  }

  const parsed = parseRaffleForm(formData);
  if (!parsed.ok) conError(detalle(raffleId), parsed.error);

  await prisma.raffle.update({ where: { id: actual.id }, data: parsed.values });
  revalidatePath(detalle(raffleId));
  redirect(`${detalle(raffleId)}?ok=guardado`);
}

export async function savePrizeAction(formData: FormData): Promise<void> {
  const { workspace } = await requireRafflesAdmin();
  const raffleId = String(formData.get("raffleId") ?? "");
  const prizeId = String(formData.get("prizeId") ?? "").trim() || null;

  const sorteo = await prisma.raffle.findFirst({
    where: { id: raffleId, workspaceId: workspace.id },
    select: { id: true, status: true },
  });
  if (!sorteo) conError(LISTA, "Ese sorteo no existe.");
  if (!canEditPrizes(sorteo.status as RaffleStatus)) {
    conError(detalle(raffleId), "Los premios se cargan antes de anunciar.");
  }

  const parsed = parsePrizeForm(formData);
  if (!parsed.ok) conError(detalle(raffleId), parsed.error);

  try {
    if (prizeId) {
      const propio = await prisma.rafflePrize.count({ where: { id: prizeId, raffleId } });
      if (propio === 0) conError(detalle(raffleId), "Ese premio no existe.");
      await prisma.rafflePrize.update({ where: { id: prizeId }, data: parsed.values });
    } else {
      await prisma.rafflePrize.create({ data: { raffleId, ...parsed.values } });
    }
  } catch (error) {
    // `redirect` lanza para cortar el flujo: no hay que tragárselo acá.
    if (error && typeof error === "object" && "digest" in error) throw error;
    conError(
      detalle(raffleId),
      "Ya hay un premio con ese orden. El orden decide qué se sortea primero.",
    );
  }

  revalidatePath(detalle(raffleId));
  redirect(`${detalle(raffleId)}?ok=premio`);
}

export async function deletePrizeAction(formData: FormData): Promise<void> {
  const { workspace } = await requireRafflesAdmin();
  const raffleId = String(formData.get("raffleId") ?? "");
  const prizeId = String(formData.get("prizeId") ?? "");

  const sorteo = await prisma.raffle.findFirst({
    where: { id: raffleId, workspaceId: workspace.id },
    select: { status: true },
  });
  if (!sorteo || !canEditPrizes(sorteo.status as RaffleStatus)) {
    conError(detalle(raffleId), "Los premios se sacan antes de anunciar.");
  }

  await prisma.rafflePrize.deleteMany({ where: { id: prizeId, raffleId } });
  revalidatePath(detalle(raffleId));
  redirect(`${detalle(raffleId)}?ok=premio-borrado`);
}

export async function announceRaffleAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireRafflesAdmin();
  const raffleId = String(formData.get("raffleId") ?? "");

  const r = await announceRaffle({
    workspaceId: workspace.id,
    raffleId,
    actorUserId: user.id,
    actorLabel: etiquetaActor(user),
  });
  if (!r.ok) conError(detalle(raffleId), r.error);

  revalidatePath(detalle(raffleId));
  redirect(`${detalle(raffleId)}?ok=anunciado`);
}

export async function sealRaffleAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireRafflesAdmin();
  const raffleId = String(formData.get("raffleId") ?? "");

  const r = await sealRaffle({
    workspaceId: workspace.id,
    raffleId,
    actorUserId: user.id,
    actorLabel: etiquetaActor(user),
  });
  if (!r.ok) conError(detalle(raffleId), r.error);

  revalidatePath(detalle(raffleId));
  redirect(`${detalle(raffleId)}?ok=sellado`);
}

export async function resolveRaffleAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireRafflesAdmin();
  const raffleId = String(formData.get("raffleId") ?? "");

  const r = await resolveRaffle({
    workspaceId: workspace.id,
    raffleId,
    actorUserId: user.id,
    actorLabel: etiquetaActor(user),
  });
  if (!r.ok) conError(detalle(raffleId), r.error);

  revalidatePath(detalle(raffleId));
  redirect(`${detalle(raffleId)}?ok=sorteado`);
}

export async function cancelRaffleAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireRafflesAdmin();
  const raffleId = String(formData.get("raffleId") ?? "");
  const motivo = String(formData.get("cancelReason") ?? "").trim();

  const sorteo = await prisma.raffle.findFirst({
    where: { id: raffleId, workspaceId: workspace.id },
    select: { id: true, status: true },
  });
  if (!sorteo) conError(LISTA, "Ese sorteo no existe.");

  const permiso = canCancel(sorteo.status as RaffleStatus);
  if (!permiso.ok) conError(detalle(raffleId), permiso.error);
  if (motivo === "") conError(detalle(raffleId), "Cancelar exige escribir el motivo.");

  await prisma.$transaction(async (tx) => {
    await tx.raffle.update({
      where: { id: sorteo.id },
      data: { status: "CANCELADO", cancelledAt: new Date(), cancelReason: motivo },
    });
    await recordRaffleEvent(tx, {
      raffleId: sorteo.id,
      type: "CANCELADO",
      actorUserId: user.id,
      actorLabel: etiquetaActor(user),
      note: motivo,
    });
  });

  revalidatePath(LISTA);
  redirect(`${LISTA}?ok=cancelado`);
}
