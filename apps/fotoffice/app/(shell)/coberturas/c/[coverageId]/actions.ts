"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireCoveragesCoordinator } from "@/lib/coverages/access";
import type { EstadoDeRol } from "@/lib/coverages/cupos";
import {
  planPublicarConvocatoria,
  puedeCrearseConvocatoria,
  puedeEditarseConvocatoria,
} from "@/lib/coverages/convocatoria";
import { recordEvent } from "@/lib/coverages/events";
import { ASSIGNMENT_LIVE_STATUSES } from "@/lib/coverages/states";

export type ConvocatoriaState = { error: string | null; ok: string | null };

const VISIBILITY_OPTIONS = new Set(["TODOS", "POR_ZONA", "POR_ESPECIALIDAD"]);
const URGENCY_OPTIONS = new Set(["NORMAL", "ALTA", "URGENTE"]);

/** Una lista escrita "una por línea" o separada por comas, como en el resto del módulo. */
function lista(v: string | undefined): string[] {
  return (v ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Los campos comunes a crear y editar, parseados y acotados a las opciones válidas.
 *
 * El `<select>` del formulario es una comodidad para quien lo completa, no el control: lo que
 * no está en las opciones válidas cae en el valor más conservador, igual que ya hace
 * `normalizarAssignmentMode` en `lib/coverages/settings.ts`.
 */
function parseCamposConvocatoria(formData: FormData) {
  const title = formData.get("title")?.toString()?.trim();
  const publicSummary = formData.get("publicSummary")?.toString()?.trim() || null;
  const privateBriefing = formData.get("privateBriefing")?.toString()?.trim() || null;
  const visibilityRaw = formData.get("visibility")?.toString() ?? "TODOS";
  const visibility = VISIBILITY_OPTIONS.has(visibilityRaw) ? visibilityRaw : "TODOS";
  const visibilityValues = lista(formData.get("visibilityValues")?.toString());
  const urgencyRaw = formData.get("urgency")?.toString() ?? "NORMAL";
  const urgency = URGENCY_OPTIONS.has(urgencyRaw) ? urgencyRaw : "NORMAL";

  const closeRaw = formData.get("applicationsCloseAt")?.toString();
  let applicationsCloseAt: Date | null = null;
  if (closeRaw) {
    const d = new Date(closeRaw);
    if (Number.isNaN(d.getTime())) return { ok: false as const, error: "Esa fecha de cierre no es válida." };
    applicationsCloseAt = d;
  }

  if (!title) return { ok: false as const, error: "Ponele un título a la convocatoria." };

  return {
    ok: true as const,
    data: { title, publicSummary, privateBriefing, visibility, visibilityValues, urgency, applicationsCloseAt },
  };
}

/**
 * Crear la convocatoria de una cobertura, en `BORRADOR`.
 *
 * `CoverageCall.coverageId` es `@unique`: si ya existiera una, `puedeCrearseConvocatoria` lo
 * frena con un mensaje legible antes de que el `create` choque contra el índice.
 */
export async function crearConvocatoriaAction(
  _prev: ConvocatoriaState | undefined,
  formData: FormData,
): Promise<ConvocatoriaState> {
  const { workspace } = await requireCoveragesCoordinator();
  const coverageId = formData.get("coverageId")?.toString() ?? "";

  const campos = parseCamposConvocatoria(formData);
  if (!campos.ok) return { error: campos.error, ok: null };

  const cobertura = await prisma.coverage.findFirst({
    where: { id: coverageId, workspaceId: workspace.id },
    select: { id: true, status: true, call: { select: { id: true } } },
  });
  if (!cobertura) return { error: "No encontramos esa cobertura.", ok: null };

  const plan = puedeCrearseConvocatoria({
    coverageStatus: cobertura.status,
    yaExiste: Boolean(cobertura.call),
  });
  if (!plan.ok) return { error: plan.error, ok: null };

  await prisma.coverageCall.create({
    data: {
      workspaceId: workspace.id,
      coverageId: cobertura.id,
      status: "BORRADOR",
      ...campos.data,
    },
  });

  revalidatePath(`/coberturas/c/${cobertura.id}`);
  return {
    error: null,
    ok: "Creada como borrador. Revisala y publicala cuando esté lista.",
  };
}

/** Editar la convocatoria mientras sigue en `BORRADOR`. Publicada, se edita desde otro lado. */
export async function editarConvocatoriaAction(
  _prev: ConvocatoriaState | undefined,
  formData: FormData,
): Promise<ConvocatoriaState> {
  const { workspace } = await requireCoveragesCoordinator();
  const callId = formData.get("callId")?.toString() ?? "";

  const campos = parseCamposConvocatoria(formData);
  if (!campos.ok) return { error: campos.error, ok: null };

  const call = await prisma.coverageCall.findFirst({
    where: { id: callId, workspaceId: workspace.id },
    select: { id: true, status: true, coverageId: true },
  });
  if (!call) return { error: "No encontramos esa convocatoria.", ok: null };
  if (!puedeEditarseConvocatoria(call.status)) {
    return { error: "Ya se publicó: no se puede editar desde acá.", ok: null };
  }

  await prisma.coverageCall.update({ where: { id: call.id }, data: campos.data });

  revalidatePath(`/coberturas/c/${call.coverageId}`);
  return { error: null, ok: "Guardado." };
}

/**
 * Publicar la convocatoria: pasa a `PUBLICADA` y la cobertura a `BUSCANDO_EQUIPO`, en la misma
 * transacción, con un evento de historial para cada una (ver el plan, Tarea 5).
 */
export async function publicarConvocatoriaAction(
  _prev: ConvocatoriaState | undefined,
  formData: FormData,
): Promise<ConvocatoriaState> {
  const { user, workspace } = await requireCoveragesCoordinator();
  const callId = formData.get("callId")?.toString() ?? "";

  const call = await prisma.coverageCall.findFirst({
    where: { id: callId, workspaceId: workspace.id },
    include: {
      coverage: {
        select: {
          status: true,
          roles: { select: { vacancies: true, assignments: { select: { status: true } } } },
        },
      },
    },
  });

  const estadoRoles: EstadoDeRol[] = (call?.coverage.roles ?? []).map((r) => ({
    vacancies: r.vacancies,
    asignadasVivas: r.assignments.filter((a) =>
      (ASSIGNMENT_LIVE_STATUSES as readonly string[]).includes(a.status),
    ).length,
    asignadasAceptadas: 0, // no la usa `puedePublicarse`; se completa igual por el tipo
  }));

  const plan = planPublicarConvocatoria({
    call,
    coverage: call?.coverage ?? { status: "" },
    roles: estadoRoles,
    workspaceId: workspace.id,
  });
  if (!plan.ok) return { error: plan.error, ok: null };
  // El plan ya garantiza que `call` no es null; este chequeo es solo para que TypeScript lo sepa.
  if (!call) return { error: "No encontramos esa convocatoria.", ok: null };

  await prisma.$transaction(async (tx) => {
    await tx.coverageCall.update({
      where: { id: call.id },
      data: { status: "PUBLICADA", publishedAt: new Date() },
    });
    await tx.coverage.update({
      where: { id: call.coverageId },
      data: { status: "BUSCANDO_EQUIPO" },
    });
    await recordEvent(tx, {
      workspaceId: workspace.id,
      entityType: "CALL",
      entityId: call.id,
      type: "ESTADO_CAMBIADO",
      fromStatus: call.status,
      toStatus: "PUBLICADA",
      actorUserId: user.id,
      actorLabel: user.name ?? user.email,
    });
    await recordEvent(tx, {
      workspaceId: workspace.id,
      entityType: "COVERAGE",
      entityId: call.coverageId,
      type: "ESTADO_CAMBIADO",
      fromStatus: call.coverage.status,
      toStatus: "BUSCANDO_EQUIPO",
      actorUserId: user.id,
      actorLabel: user.name ?? user.email,
    });
  });

  revalidatePath(`/coberturas/c/${call.coverageId}`);
  revalidatePath("/coberturas");
  return { error: null, ok: "Publicada. Ya se puede ver y postularse." };
}
