"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import { actorLabel, requireGovernanceManager } from "@/lib/governance/access";
import { recordProjectEvent } from "@/lib/governance/events";
import { parseQuoteForm, parseReservationForm } from "@/lib/governance/money";
import { canHandleProjectMoney, isCashOn } from "@/lib/governance/money-server";
import { verifyGovernanceUpload } from "@/lib/governance/files";
import { safeFilename } from "@/lib/governance/file-names";
import { canEditStructure } from "@/lib/governance/lifecycle";
import { parseMovementForm } from "@/lib/cash/movement-form";
import { recordCashMovement } from "@/lib/cash/record-movement";
import { formatMinorArs, minorToDecimalString, parseArsToMinor } from "@/lib/membership/money";
import { parseDateOnly } from "@/lib/governance/forms";
import type { ProjectStatus } from "@/lib/governance/constants";

/**
 * La plata de los proyectos (etapa 3 del diseño de Gobierno, §8).
 *
 * - Cotizaciones y costos estimados: quien gestiona proyectos.
 * - Reservas, gastos, ingresos y saldos de apertura: además, Caja en Gestionar con la acción
 *   `cash.project_money` (diseño de Roles §12.1.2). Por defecto la tienen dueño y admin.
 *
 * Un gasto o ingreso del proyecto es un movimiento de Caja: se escribe una sola vez, en el
 * libro, y el proyecto lo enlaza. Anularlo en Caja lo saca de los números del proyecto.
 */

const detalle = (id: string) => `/gobierno/${id}`;
const campo = (fd: FormData, n: string) => String(fd.get(n) ?? "").trim();
const dinero = (id: string) => `${detalle(id)}#dinero`;

function conError(projectId: string, error: string): never {
  redirect(`${detalle(projectId)}?error=${encodeURIComponent(error)}#dinero`);
}

async function proyectoDe(workspaceId: string, projectId: string) {
  const p = await prisma.govProject.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true, status: true, title: true },
  });
  return p ? { ...p, status: p.status as ProjectStatus } : null;
}

/** Plata que entra o sale: sólo con el proyecto aprobado o en ejecución (§5.2). */
function aceptaPlata(status: ProjectStatus): boolean {
  return status === "APPROVED" || status === "IN_PROGRESS";
}

async function exigirPermisoDePlata(userId: number, workspaceId: string, projectId: string) {
  if (!(await isCashOn(workspaceId))) conError(projectId, "Caja no está encendida en esta institución.");
  if (!(await canHandleProjectMoney(userId, workspaceId))) {
    conError(projectId, "Para mover plata de proyectos hace falta Caja en Gestionar con «Plata de proyectos».");
  }
}

// ─── Cotizaciones ────────────────────────────────────────────────────────────

/** Desde el formulario de cliente: crea la cotización y devuelve su id para subir el archivo. */
export async function createQuoteAction(input: {
  projectId: string;
  stageId: string;
  supplier: string;
  amount: string;
  quotedAt: string;
  validUntil: string;
  note: string;
}): Promise<{ ok: true; quoteId: string } | { ok: false; error: string }> {
  const { workspace, user } = await requireGovernanceManager();
  const p = await proyectoDe(workspace.id, String(input.projectId));
  if (!p) return { ok: false, error: "Ese proyecto no existe." };
  if (!canEditStructure(p.status)) return { ok: false, error: "En este estado ya no se cargan cotizaciones." };
  const parsed = parseQuoteForm(input);
  if (!parsed.ok) return parsed;
  const v = parsed.values;
  const etapa = await prisma.govProjectStage.findFirst({ where: { id: v.stageId, projectId: p.id }, select: { id: true, title: true } });
  if (!etapa) return { ok: false, error: "Esa etapa no existe." };
  const q = await prisma.$transaction(async (tx) => {
    const creada = await tx.govQuote.create({
      data: {
        projectId: p.id,
        stageId: etapa.id,
        supplier: v.supplier,
        amountArs: minorToDecimalString(v.amountMinor),
        quotedAt: v.quotedAt,
        validUntil: v.validUntil,
        note: v.note,
        createdByUserId: user.id,
      },
      select: { id: true },
    });
    await recordProjectEvent(tx, {
      projectId: p.id,
      type: "QUOTE_ADDED",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { supplier: v.supplier, amount: formatMinorArs(v.amountMinor), stage: etapa.title },
    });
    return creada;
  });
  revalidatePath(detalle(p.id));
  return { ok: true, quoteId: q.id };
}

export async function registerQuoteFilesAction(input: {
  projectId: string;
  quoteId: string;
  files: { key: string; filename: string }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { workspace, user } = await requireGovernanceManager();
  const q = await prisma.govQuote.findFirst({
    where: { id: String(input.quoteId), projectId: String(input.projectId), project: { workspaceId: workspace.id } },
    select: { id: true, projectId: true },
  });
  if (!q) return { ok: false, error: "Esa cotización no existe." };
  const files = (input.files ?? []).slice(0, 5);
  const verificados = [];
  for (const f of files) {
    const r = await verifyGovernanceUpload(String(f.key), workspace.id, q.projectId);
    if (!r.ok) return { ok: false, error: `${safeFilename(String(f.filename))}: ${r.error}` };
    verificados.push({ key: String(f.key), filename: safeFilename(String(f.filename)), sizeBytes: r.sizeBytes, contentType: r.contentType });
  }
  await prisma.govAttachment.createMany({
    data: verificados.map((f) => ({
      workspaceId: workspace.id,
      projectId: q.projectId,
      quoteId: q.id,
      r2Key: f.key,
      filename: f.filename,
      contentType: f.contentType,
      sizeBytes: f.sizeBytes,
      // Nunca visible para socios: puede tener datos del proveedor (§6).
      visibleToMembers: false,
      uploadedByUserId: user.id,
    })),
  });
  revalidatePath(detalle(q.projectId));
  return { ok: true };
}

export async function setQuoteStatusAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  const q = await prisma.govQuote.findFirst({
    where: { id: campo(fd, "quoteId"), projectId, project: { workspaceId: workspace.id } },
    select: { id: true, stageId: true, supplier: true, status: true },
  });
  if (!q) conError(projectId, "Esa cotización no existe.");
  const status = campo(fd, "status");
  if (!["RECEIVED", "CHOSEN", "DISCARDED"].includes(status)) conError(projectId, "Ese estado no existe.");
  const motivo = campo(fd, "reason") || null;
  await prisma.$transaction(async (tx) => {
    // A lo sumo una elegida por etapa: elegir una devuelve la anterior a "recibida".
    if (status === "CHOSEN") {
      await tx.govQuote.updateMany({ where: { stageId: q.stageId, status: "CHOSEN", NOT: { id: q.id } }, data: { status: "RECEIVED" } });
    }
    await tx.govQuote.update({
      where: { id: q.id },
      data: { status, discardReason: status === "DISCARDED" ? motivo : null },
    });
    await recordProjectEvent(tx, {
      projectId,
      type: "QUOTE_STATUS",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { supplier: q.supplier, status, reason: motivo },
    });
  });
  revalidatePath(detalle(projectId));
  redirect(dinero(projectId));
}

export async function setStageEstimateAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  const p = await proyectoDe(workspace.id, projectId);
  if (!p) redirect("/gobierno");
  const etapa = await prisma.govProjectStage.findFirst({ where: { id: campo(fd, "stageId"), projectId }, select: { id: true, title: true } });
  if (!etapa) conError(projectId, "Esa etapa no existe.");
  const crudo = campo(fd, "amount");
  const minor = crudo ? parseArsToMinor(crudo) : null;
  if (crudo && minor === null) conError(projectId, "El monto no se entiende.");
  await prisma.$transaction(async (tx) => {
    await tx.govProjectStage.update({ where: { id: etapa.id }, data: { estimatedCostArs: minor ? minorToDecimalString(minor) : null } });
    await recordProjectEvent(tx, {
      projectId,
      type: "STAGE_ESTIMATE",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { stage: etapa.title, amount: minor ? formatMinorArs(minor) : "" },
    });
  });
  revalidatePath(detalle(projectId));
  redirect(dinero(projectId));
}

// ─── Reservas, gastos e ingresos ─────────────────────────────────────────────

export async function addReservationAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  const p = await proyectoDe(workspace.id, projectId);
  if (!p) redirect("/gobierno");
  await exigirPermisoDePlata(user.id, workspace.id, projectId);
  if (!aceptaPlata(p.status)) conError(projectId, "Se reserva plata sólo para proyectos aprobados o en ejecución.");
  const parsed = parseReservationForm(fd);
  if (!parsed.ok) conError(projectId, parsed.error);
  const { amountMinor, reason } = parsed.values;
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.govReservation.create({
      data: { projectId, amountArs: minorToDecimalString(amountMinor), reason, createdByUserId: user.id, actorLabel: actorLabel(user) },
    });
    await recordProjectEvent(tx, {
      projectId,
      type: "RESERVATION",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { amount: formatMinorArs(Math.abs(amountMinor)), release: amountMinor < 0, reason },
    });
  });
  revalidatePath(detalle(projectId));
  revalidatePath("/caja");
  redirect(`${detalle(projectId)}?ok=dinero#dinero`);
}

/**
 * "Registrar gasto" / "Registrar ingreso": crea el movimiento en Caja y lo enlaza al proyecto.
 *
 * Idempotente: el formulario trae un `token` de un solo uso que va como `sourceRef` del
 * movimiento, y `(sourceModule, sourceRef)` es único en la base. Un doble clic no duplica.
 */
export async function recordProjectMovementAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  const p = await proyectoDe(workspace.id, projectId);
  if (!p) redirect("/gobierno");
  await exigirPermisoDePlata(user.id, workspace.id, projectId);
  if (!aceptaPlata(p.status)) conError(projectId, "Se registra plata sólo en proyectos aprobados o en ejecución.");
  const token = campo(fd, "token");
  if (!/^[\w-]{16,64}$/.test(token)) conError(projectId, "Recargá la página y volvé a intentar.");
  const parsed = parseMovementForm(fd);
  if (!parsed.ok) conError(projectId, parsed.error);
  const v = parsed.values;

  const [cuenta, categoria] = await Promise.all([
    prisma.cashAccount.findFirst({ where: { id: v.accountId, workspaceId: workspace.id }, select: { id: true, name: true } }),
    v.categoryId
      ? prisma.cashCategory.count({ where: { id: v.categoryId, workspaceId: workspace.id, kind: v.kind } })
      : Promise.resolve(1),
  ]);
  if (!cuenta) conError(projectId, "Esa cuenta no existe.");
  if (categoria === 0) conError(projectId, "Esa categoría no existe para ese tipo de movimiento.");

  const stageId = campo(fd, "stageId") || null;
  const quoteId = campo(fd, "quoteId") || null;
  if (stageId && (await prisma.govProjectStage.count({ where: { id: stageId, projectId } })) === 0) conError(projectId, "Esa etapa no existe.");
  if (quoteId && (await prisma.govQuote.count({ where: { id: quoteId, projectId } })) === 0) conError(projectId, "Esa cotización no existe.");

  await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const mov = await recordCashMovement(tx, {
        workspaceId: workspace.id,
        accountId: cuenta.id,
        kind: v.kind,
        amountMinor: v.amountMinor,
        occurredAt: v.occurredAt,
        description: `${p.title}: ${v.description}`.slice(0, 500),
        sourceModule: "governance",
        sourceRef: token,
        categoryId: v.categoryId,
        paymentMethod: v.paymentMethod,
        createdByUserId: user.id,
      });
      if (!mov.created) return; // Ya estaba: el mismo formulario se mandó dos veces.
      await tx.govProjectMovement.create({ data: { projectId, stageId, quoteId, cashMovementId: mov.id } });
      await recordProjectEvent(tx, {
        projectId,
        type: "MOVEMENT_LINKED",
        actorUserId: user.id,
        actorLabel: actorLabel(user),
        data: { kind: v.kind, amount: formatMinorArs(v.amountMinor), account: cuenta.name, description: v.description },
      });
    },
    { timeout: 20_000 },
  );
  revalidatePath(detalle(projectId));
  revalidatePath("/caja");
  revalidatePath("/caja/movimientos");
  redirect(`${detalle(projectId)}?ok=dinero#dinero`);
}

/** Proyectos que ya venían en curso: lo asignado y gastado antes de usar el sistema (§8.5). */
export async function saveOpeningAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceManager();
  const projectId = campo(fd, "projectId");
  const p = await proyectoDe(workspace.id, projectId);
  if (!p) redirect("/gobierno");
  await exigirPermisoDePlata(user.id, workspace.id, projectId);
  const asignado = campo(fd, "assigned") ? parseArsToMinor(campo(fd, "assigned")) : 0;
  const gastado = campo(fd, "spent") ? parseArsToMinor(campo(fd, "spent")) : 0;
  if (asignado === null || gastado === null) conError(projectId, "Los montos no se entienden.");
  const fecha = campo(fd, "at") ? parseDateOnly(campo(fd, "at")) : null;
  if (campo(fd, "at") && !fecha) conError(projectId, "La fecha no se entiende.");
  const manual = campo(fd, "manualNeeded") ? parseArsToMinor(campo(fd, "manualNeeded")) : null;
  if (campo(fd, "manualNeeded") && manual === null) conError(projectId, "El costo aproximado no se entiende.");
  await prisma.$transaction(async (tx) => {
    await tx.govProject.update({
      where: { id: projectId },
      data: {
        openingAssignedArs: asignado ? minorToDecimalString(asignado) : null,
        openingSpentArs: gastado ? minorToDecimalString(gastado) : null,
        openingAt: fecha,
        manualNeededArs: manual ? minorToDecimalString(manual) : null,
      },
    });
    await recordProjectEvent(tx, {
      projectId,
      type: "OPENING_SET",
      actorUserId: user.id,
      actorLabel: actorLabel(user),
      data: { assigned: formatMinorArs(asignado), spent: formatMinorArs(gastado) },
    });
  });
  revalidatePath(detalle(projectId));
  redirect(`${detalle(projectId)}?ok=dinero#dinero`);
}
