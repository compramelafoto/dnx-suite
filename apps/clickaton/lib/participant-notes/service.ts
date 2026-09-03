import "server-only";

import { prisma } from "@repo/db";
import { systemClock, type EditionClock } from "@/lib/timeline/clock";
import { getUploadWindowState, resolveEffectiveWindows } from "@/lib/photo-upload/windows";
import {
  areEditionNotesExpired,
  normalizeNoteBody,
  shouldAcceptNoteWrite,
} from "./domain";

/**
 * Cuaderno del participante.
 *
 * Privacidad: la única forma de leer una nota es siendo el dueño de la
 * inscripción. No hay lectura para la organización ni para el jurado.
 *
 * La tabla `ClickatonPromptNote` puede no existir todavía en una base: el
 * deploy no corre migraciones. Cuando falta, la pantalla tiene que seguir
 * andando sin notas del servidor en vez de romperse, así que las lecturas
 * devuelven vacío y las escrituras avisan que no se pudo guardar.
 */

export type ParticipantNote = {
  promptId: string;
  body: string;
  solved: boolean;
  updatedAt: string;
};

export type NotesActor = { id: number; email: string };

export type NotesResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "NOT_FOUND" | "CLOSED" | "STORAGE_UNAVAILABLE" };

function esTablaAusente(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "P2021" || code === "P2022") return true;
  const message =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  return /ClickatonPromptNote/.test(message) && /does not exist/i.test(message);
}

async function cargarInscripcion(registrationId: string, actor: NotesActor) {
  const registration = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: { id: true, userId: true, email: true, editionId: true },
  });
  if (!registration) return null;
  const propia =
    registration.userId === actor.id ||
    registration.email.toLowerCase() === actor.email.toLowerCase();
  return propia ? registration : null;
}

export async function listParticipantNotes(input: {
  registrationId: string;
  actor: NotesActor;
}): Promise<NotesResult<ParticipantNote[]>> {
  const registration = await cargarInscripcion(input.registrationId, input.actor);
  if (!registration) return { ok: false, reason: "NOT_FOUND" };

  try {
    const filas = await prisma.clickatonPromptNote.findMany({
      where: { registrationId: registration.id },
      select: { promptId: true, body: true, solved: true, updatedAt: true },
    });
    return {
      ok: true,
      data: filas.map((f) => ({
        promptId: f.promptId,
        body: f.body,
        solved: f.solved,
        updatedAt: f.updatedAt.toISOString(),
      })),
    };
  } catch (error) {
    if (esTablaAusente(error)) return { ok: false, reason: "STORAGE_UNAVAILABLE" };
    throw error;
  }
}

/** La entrega cerrada también cierra el cuaderno: no se escribe después del evento. */
async function ventanaAbierta(editionId: string, clock: EditionClock): Promise<boolean> {
  const prompt = await prisma.clickatonPrompt.findFirst({
    where: { editionId, status: { notIn: ["DRAFT", "CANCELLED"] } },
    orderBy: { sequence: "asc" },
    select: {
      status: true,
      releasedAt: true,
      captureStartsAt: true,
      captureEndsAt: true,
      uploadStartsAt: true,
      uploadEndsAt: true,
    },
  });
  if (!prompt) return true; // sin consignas cargadas no hay nada que cerrar
  return getUploadWindowState(resolveEffectiveWindows(prompt), clock) !== "CLOSED";
}

export async function saveParticipantNote(input: {
  registrationId: string;
  promptId: string;
  actor: NotesActor;
  body?: string;
  solved?: boolean;
  clientUpdatedAt?: Date | null;
  clock?: EditionClock;
}): Promise<NotesResult<ParticipantNote>> {
  const clock = input.clock ?? systemClock();
  const registration = await cargarInscripcion(input.registrationId, input.actor);
  if (!registration) return { ok: false, reason: "NOT_FOUND" };

  const prompt = await prisma.clickatonPrompt.findFirst({
    where: { id: input.promptId, editionId: registration.editionId },
    select: { id: true },
  });
  if (!prompt) return { ok: false, reason: "NOT_FOUND" };

  if (!(await ventanaAbierta(registration.editionId, clock))) {
    return { ok: false, reason: "CLOSED" };
  }

  try {
    const existente = await prisma.clickatonPromptNote.findUnique({
      where: {
        registrationId_promptId: {
          registrationId: registration.id,
          promptId: prompt.id,
        },
      },
    });

    // Escritura vieja de otro dispositivo: se descarta y se devuelve lo guardado.
    if (
      existente &&
      !shouldAcceptNoteWrite({
        storedClientUpdatedAt: existente.clientUpdatedAt,
        incomingClientUpdatedAt: input.clientUpdatedAt ?? null,
      })
    ) {
      return {
        ok: true,
        data: {
          promptId: existente.promptId,
          body: existente.body,
          solved: existente.solved,
          updatedAt: existente.updatedAt.toISOString(),
        },
      };
    }

    const body = input.body === undefined ? undefined : normalizeNoteBody(input.body);
    const solved = input.solved;
    const ahora = clock.now();

    const fila = await prisma.clickatonPromptNote.upsert({
      where: {
        registrationId_promptId: {
          registrationId: registration.id,
          promptId: prompt.id,
        },
      },
      create: {
        editionId: registration.editionId,
        registrationId: registration.id,
        promptId: prompt.id,
        body: body ?? "",
        solved: solved ?? false,
        solvedAt: solved ? ahora : null,
        clientUpdatedAt: input.clientUpdatedAt ?? null,
      },
      update: {
        ...(body === undefined ? {} : { body }),
        ...(solved === undefined
          ? {}
          : { solved, solvedAt: solved ? (existente?.solvedAt ?? ahora) : null }),
        clientUpdatedAt: input.clientUpdatedAt ?? existente?.clientUpdatedAt ?? null,
      },
    });

    return {
      ok: true,
      data: {
        promptId: fila.promptId,
        body: fila.body,
        solved: fila.solved,
        updatedAt: fila.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    if (esTablaAusente(error)) return { ok: false, reason: "STORAGE_UNAVAILABLE" };
    throw error;
  }
}

/** Borra las notas de las ediciones cuya entrega cerró hace más de 30 días. */
export async function purgeExpiredNotes(options?: {
  now?: Date;
  days?: number;
  dryRun?: boolean;
}): Promise<{ editions: Array<{ editionId: string; notes: number }>; count: number }> {
  const now = options?.now ?? new Date();

  const configs = await prisma.clickatonEditionUploadConfig.findMany({
    select: { editionId: true, uploadWindowEndsAt: true },
  });
  const vencidas = configs.filter((c) =>
    areEditionNotesExpired({
      uploadWindowEndsAt: c.uploadWindowEndsAt,
      now,
      days: options?.days,
    }),
  );

  const editions: Array<{ editionId: string; notes: number }> = [];
  for (const edicion of vencidas) {
    if (options?.dryRun) {
      const notes = await prisma.clickatonPromptNote.count({
        where: { editionId: edicion.editionId },
      });
      if (notes > 0) editions.push({ editionId: edicion.editionId, notes });
      continue;
    }
    const borradas = await prisma.clickatonPromptNote.deleteMany({
      where: { editionId: edicion.editionId },
    });
    if (borradas.count > 0) {
      editions.push({ editionId: edicion.editionId, notes: borradas.count });
    }
  }

  return { editions, count: editions.reduce((n, e) => n + e.notes, 0) };
}
