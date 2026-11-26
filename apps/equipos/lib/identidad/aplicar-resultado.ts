import { prisma } from "@repo/db";
import { sendPortalEmail } from "../correo";
import { hashDni, normalizeDni } from "./dni";
import { decideVerification, type ProviderResult } from "./resultado";

export type ApplyOutcome = "applied" | "unknown_ref" | "already_final";

export async function applyProviderResult(result: ProviderResult): Promise<ApplyOutcome> {
  const row = await prisma.identityVerification.findUnique({
    where: { providerRef: result.providerRef },
  });
  if (!row) return "unknown_ref";
  if (row.status === "APPROVED" || row.status === "REJECTED") return "already_final";

  const pepper = process.env.IDENTITY_DNI_PEPPER;
  if (!pepper) throw new Error("Falta IDENTITY_DNI_PEPPER");

  // ¿Otro usuario ya verificó este DNI? La consulta vive acá; la decisión, en la función pura.
  let hashOwnerUserId: number | null = null;
  const dni = result.documentNumber ? normalizeDni(result.documentNumber) : null;
  if (result.outcome === "approved" && dni) {
    // documentHash es único: quien lo tiene, en el estado que sea, es el dueño.
    const owner = await prisma.identityVerification.findFirst({
      where: { documentHash: hashDni(dni, pepper), userId: { not: row.userId } },
      select: { userId: true },
    });
    hashOwnerUserId = owner?.userId ?? null;
  }

  const decision = decideVerification(result, {
    userId: row.userId,
    hashOwnerUserId,
    pepper,
    previous: {
      documentHash: row.documentHash ?? null,
      documentLast3: row.documentLast3 ?? null,
      legalName: row.legalName ?? null,
    },
  });

  await prisma.identityVerification.update({
    where: { id: row.id },
    data: {
      status: decision.status,
      documentHash: decision.documentHash,
      documentLast3: decision.documentLast3,
      legalName: decision.legalName,
      rejectionReason: decision.rejectionReason,
      approvedAt: decision.status === "APPROVED" ? new Date() : null,
      // Re-verificación completada: vuelve a nivel "identidad".
      ...(decision.status === "APPROVED" ? { reverifyRequiredAt: null } : {}),
    },
  });

  if (decision.status === "IN_REVIEW") {
    const admin = process.env.ADMIN_EMAIL;
    if (admin) {
      await sendPortalEmail(admin, "verificacion_en_revision_admin", {
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin/verificaciones`,
      });
    }
  } else {
    const user = await prisma.user.findUnique({
      where: { id: row.userId },
      select: { email: true, name: true },
    });
    if (user?.email) {
      await sendPortalEmail(
        user.email,
        decision.status === "APPROVED" ? "verificacion_aprobada" : "verificacion_rechazada",
        { nombre: user.name ?? "", motivo: decision.rejectionReason ?? "" },
      );
    }
  }
  return "applied";
}
