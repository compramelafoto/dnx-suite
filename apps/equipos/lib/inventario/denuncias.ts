import { prisma } from "@repo/db";
import { uploadPrivateFile, validateFile } from "@/lib/archivos";
import { sendPortalEmail } from "@/lib/correo";
import { EquipoError, findOwnItem } from "./equipos";

/** Estados desde los que se puede denunciar (un equipo recuperado puede volver a ser robado). */
const REPORTABLE_STATUSES = ["IN_USE", "FOR_SALE", "RECOVERED"];

/**
 * Denuncias de robo o pérdida desde «Mi equipo». Crean una `StolenGearReport` en revisión (la
 * misma que usa el panel de CLF) y cruzan a diario las denuncias activas contra los inventarios.
 */

export type IncidentInput = {
  incident: "THEFT" | "LOST";
  occurredAt: Date;
  place?: string;
  description?: string;
  policeReportNumber?: string;
  invoice?: File;
  policeReport?: File;
};

async function uploadProof(file: File): Promise<{ key: string; mime: string }> {
  const error = validateFile(file, "proof");
  if (error) throw new EquipoError("ARCHIVO_INVALIDO", error);
  return uploadPrivateFile(file, "proof");
}

const clean = (v: string | undefined): string | null => v?.trim() || null;

export async function reportIncident(
  userId: number,
  itemId: number,
  input: IncidentInput,
): Promise<{ reportId: number | null }> {
  const item = await findOwnItem(userId, itemId);
  if (item.status === "STOLEN" || item.status === "LOST") {
    throw new EquipoError("YA_DENUNCIADO", "Este equipo ya tiene una denuncia.");
  }
  if (!REPORTABLE_STATUSES.includes(item.status)) {
    throw new EquipoError("NO_DENUNCIABLE", "Este equipo figura como vendido.");
  }
  if (!(input.occurredAt instanceof Date) || Number.isNaN(input.occurredAt.getTime())) {
    throw new EquipoError("DATO_INVALIDO", "Indicá la fecha del hecho.");
  }
  if (input.occurredAt.getTime() > Date.now() + 24 * 3600 * 1000) {
    throw new EquipoError("DATO_INVALIDO", "La fecha del hecho no puede ser futura.");
  }

  const hasSerial = (item.kind === "BODY" || item.kind === "LENS") && !!item.serialNormalized;

  // Comprobante: el del equipo si ya existe; si no, el adjunto (que además queda en el equipo).
  let invoiceKey = item.purchaseProofKey ?? null;
  let invoiceMime = item.purchaseProofMime ?? null;
  let newProof = false;
  if (!invoiceKey && input.invoice && input.invoice.size > 0) {
    const up = await uploadProof(input.invoice);
    invoiceKey = up.key;
    invoiceMime = up.mime;
    newProof = true;
  }
  if (hasSerial && input.incident === "THEFT" && !invoiceKey) {
    throw new EquipoError(
      "FALTA_COMPROBANTE",
      "Para denunciar un robo hace falta el comprobante de compra.",
    );
  }

  let policeKey: string | null = null;
  let policeMime: string | null = null;
  if (hasSerial && input.policeReport && input.policeReport.size > 0) {
    const up = await uploadProof(input.policeReport);
    policeKey = up.key;
    policeMime = up.mime;
  }

  const newStatus = input.incident === "THEFT" ? "STOLEN" : "LOST";
  const reportId = await prisma.$transaction(async (tx) => {
    let id: number | null = null;
    if (hasSerial) {
      const report = await tx.stolenGearReport.create({
        data: {
          reporterId: userId,
          kind: item.kind as "BODY" | "LENS",
          make: item.make,
          model: item.model,
          serialRaw: item.serialRaw!,
          serialNormalized: item.serialNormalized!,
          stolenAt: input.occurredAt,
          stolenPlace: clean(input.place),
          description: clean(input.description),
          policeReportNumber: clean(input.policeReportNumber),
          incident: input.incident,
          gearItemId: itemId,
          invoiceKey,
          invoiceMime,
          policeReportKey: policeKey,
          policeReportMime: policeMime,
          status: "PENDING_REVIEW",
        },
      });
      id = report.id;
    }
    await tx.gearItem.update({
      where: { id: itemId },
      data: {
        status: newStatus,
        ...(newProof ? { purchaseProofKey: invoiceKey, purchaseProofMime: invoiceMime } : {}),
      },
    });
    await tx.gearItemEvent.create({
      data: {
        gearItemId: itemId,
        type: "REPORTED",
        detail: { incident: input.incident, from: item.status, reportId: id },
      },
    });
    return id;
  });

  if (reportId != null) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      if (user?.email) {
        await sendPortalEmail(user.email, "denuncia_recibida", {
          nombre: user.name ?? "",
          referencia: `#${reportId}`,
        });
      }
    } catch (err) {
      console.error("[denuncias] No se pudo enviar el correo de denuncia recibida:", err);
    }
  }
  return { reportId };
}

export async function markRecovered(userId: number, itemId: number): Promise<void> {
  const item = await findOwnItem(userId, itemId);
  if (item.status !== "STOLEN" && item.status !== "LOST") {
    throw new EquipoError("DATO_INVALIDO", "Sólo se puede marcar como recuperado un equipo robado o perdido.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.gearItem.update({ where: { id: itemId }, data: { status: "RECOVERED" } });
    await tx.stolenGearReport.updateMany({
      where: { gearItemId: itemId, reporterId: userId, status: { in: ["ACTIVE", "PENDING_REVIEW"] } },
      data: { status: "RECOVERED", recoveredAt: new Date() },
    });
    await tx.gearItemEvent.create({
      data: { gearItemId: itemId, type: "RECOVERED", detail: { from: item.status } },
    });
  });
}

/** Denuncias ACTIVE contra equipos de OTROS dueños con la misma serie normalizada. */
export async function findInventoryMatches(): Promise<
  Array<{ reportId: number; gearItemId: number }>
> {
  const reports = await prisma.stolenGearReport.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, reporterId: true, serialNormalized: true },
  });
  const out: Array<{ reportId: number; gearItemId: number }> = [];
  for (const r of reports) {
    const items = await prisma.gearItem.findMany({
      where: { serialNormalized: r.serialNormalized, ownerId: { not: r.reporterId } },
      select: { id: true },
    });
    for (const it of items) out.push({ reportId: r.id, gearItemId: it.id });
  }
  return out;
}

/**
 * Avisa al admin sólo de las coincidencias nuevas. Lo ya avisado se recuerda con un
 * `GearItemEvent` de tipo UPDATED en el equipo coincidente, con `detail: { matchReportId }`.
 */
export async function notifyNewInventoryMatches(): Promise<{ found: number; notified: number }> {
  const matches = await findInventoryMatches();
  const to = process.env.ADMIN_EMAIL?.trim();
  let notified = 0;
  for (const mt of matches) {
    const seen = await prisma.gearItemEvent.findFirst({
      where: {
        gearItemId: mt.gearItemId,
        type: "UPDATED",
        detail: { path: ["matchReportId"], equals: mt.reportId },
      },
      select: { id: true },
    });
    if (seen) continue;
    if (!to) {
      console.warn("[cruce-inventario] ADMIN_EMAIL no configurado; no se avisa.");
      continue;
    }
    const base = process.env.CLF_URL?.replace(/\/$/, "");
    const res = await sendPortalEmail(to, "coincidencia_inventario_admin", {
      detalle: `Denuncia #${mt.reportId} coincide con el equipo #${mt.gearItemId} del portal.`,
      url: base ? `${base}/admin/equipos-robados` : "",
    });
    if (!res.success) continue; // se reintenta mañana
    await prisma.gearItemEvent.create({
      data: {
        gearItemId: mt.gearItemId,
        type: "UPDATED",
        detail: { matchReportId: mt.reportId },
      },
    });
    notified++;
  }
  return { found: matches.length, notified };
}
