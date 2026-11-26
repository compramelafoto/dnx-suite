import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { requireLevel } from "@/lib/guards";
import { EquipoError } from "@/lib/inventario/equipos";
import { fechaInput } from "@/lib/inventario/formato";

/**
 * Informe de equipos para aseguradoras. Lo que se emite es una FOTO (snapshot) del inventario
 * en ese momento: la página pública y el PDF muestran sólo esa foto, nunca datos en vivo. Del
 * DNI se guardan únicamente los últimos 3 dígitos.
 */

export type ReportItem = {
  kind: string;
  make: string;
  model: string;
  serialRaw: string | null;
  status: string;
  purchaseDate: string | null;
  hasPurchaseProof: boolean;
  seal: { photosCount: number; since: string } | null;
  valueArs: number;
  valueUsd: number;
};

export type ReportSnapshot = {
  issuedAt: string;
  holder: { legalName: string; documentLast3: string };
  items: ReportItem[];
  totalArs: number;
  totalUsd: number;
};

/** Lo mínimo que hace falta de un equipo (con su avistaje de CLF, si lo tiene). */
export type SnapshotGear = {
  kind: string;
  make: string;
  model: string;
  serialRaw: string | null;
  status: string;
  purchaseDate: Date | null;
  purchaseProofKey: string | null;
  declaredValueArs: number | null;
  declaredValueUsd: number | null;
  sighting: { photosCount: number; firstSeenAt: Date } | null;
};

export type SnapshotInput = {
  issuedAt: Date;
  holder: { legalName: string; documentLast3: string };
  items: SnapshotGear[];
};

/** Pura: arma la foto. El sello sale del avistaje de CLF vinculado al equipo. */
export function buildSnapshot(input: SnapshotInput): ReportSnapshot {
  const items: ReportItem[] = input.items.map((g) => ({
    kind: g.kind,
    make: g.make,
    model: g.model,
    serialRaw: g.serialRaw,
    status: g.status,
    purchaseDate: g.purchaseDate ? fechaInput(g.purchaseDate) : null,
    hasPurchaseProof: !!g.purchaseProofKey,
    seal: g.sighting
      ? { photosCount: g.sighting.photosCount, since: fechaInput(g.sighting.firstSeenAt) }
      : null,
    valueArs: g.declaredValueArs ?? 0,
    valueUsd: g.declaredValueUsd ?? 0,
  }));
  return {
    issuedAt: input.issuedAt.toISOString(),
    holder: { legalName: input.holder.legalName, documentLast3: input.holder.documentLast3 },
    items,
    totalArs: items.reduce((a, i) => a + i.valueArs, 0),
    totalUsd: items.reduce((a, i) => a + i.valueUsd, 0),
  };
}

/** JSON canónico: claves ordenadas en todos los niveles; los arreglos conservan su orden. */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

export function hashSnapshot(s: ReportSnapshot): string {
  return createHash("sha256").update(JSON.stringify(canonical(s))).digest("hex");
}

const NO_ASEGURABLES = ["STOLEN", "LOST", "SOLD"];

export async function createInsuranceReport(
  userId: number,
  itemIds: number[],
): Promise<{ code: string }> {
  await requireLevel("identidad", "/mi-equipo/informe");

  const ids = [...new Set(itemIds)];
  if (ids.length === 0 || ids.some((n) => !Number.isInteger(n))) {
    throw new EquipoError("DATO_INVALIDO", "Elegí al menos un equipo.");
  }

  // Filtra por dueño: un equipo ajeno es, a todos los efectos, uno que no existe.
  const items = await prisma.gearItem.findMany({
    where: { id: { in: ids }, ownerId: userId },
    include: { sighting: { select: { photosCount: true, firstSeenAt: true } } },
    orderBy: { id: "asc" },
  });
  if (items.length !== ids.length) throw new EquipoError("NO_ENCONTRADO");

  for (const it of items) {
    if (NO_ASEGURABLES.includes(it.status)) {
      throw new EquipoError(
        "NO_ASEGURABLE",
        `${it.make} ${it.model}: un equipo robado, perdido o vendido no se puede incluir en el informe.`,
      );
    }
    if (it.declaredValueArs == null || it.declaredValueUsd == null) {
      throw new EquipoError(
        "FALTA_VALOR",
        `${it.make} ${it.model}: cargá el valor en pesos y en dólares para incluirlo.`,
      );
    }
  }

  const identity = await prisma.identityVerification.findUnique({
    where: { userId },
    select: { status: true, legalName: true, documentLast3: true, reverifyRequiredAt: true },
  });
  if (
    !identity ||
    identity.status !== "APPROVED" ||
    identity.reverifyRequiredAt ||
    !identity.legalName?.trim() ||
    !identity.documentLast3
  ) {
    throw new EquipoError("DATO_INVALIDO", "Necesitás tener la identidad verificada.");
  }

  const snapshot = buildSnapshot({
    issuedAt: new Date(),
    holder: {
      legalName: identity.legalName.trim(),
      documentLast3: identity.documentLast3.slice(-3),
    },
    items,
  });
  const code = randomBytes(16).toString("base64url");
  await prisma.insuranceReport.create({
    data: {
      ownerId: userId,
      code,
      contentHash: hashSnapshot(snapshot),
      snapshot: snapshot as unknown as object,
      totalArs: snapshot.totalArs,
      totalUsd: snapshot.totalUsd,
    },
  });
  return { code };
}

export type PublicReport = {
  snapshot: ReportSnapshot;
  issuedAt: Date;
  contentHash: string;
  /** El hash guardado coincide con el del contenido guardado. */
  hashOk: boolean;
  /** Estado ACTUAL de la verificación del titular. */
  holderVerified: boolean;
};

/**
 * Lo que ve cualquiera con el código: sólo el snapshot guardado, nunca datos en vivo del
 * equipo ni del titular (ni correo, ni teléfono, ni id).
 */
export async function getPublicReport(code: string): Promise<PublicReport | null> {
  const report = await prisma.insuranceReport.findUnique({ where: { code } });
  if (!report) return null;
  const identity = await prisma.identityVerification.findUnique({
    where: { userId: report.ownerId },
    select: { status: true, reverifyRequiredAt: true },
  });
  const snapshot = report.snapshot as unknown as ReportSnapshot;
  return {
    snapshot,
    issuedAt: report.createdAt,
    contentHash: report.contentHash,
    hashOk: hashSnapshot(snapshot) === report.contentHash,
    holderVerified: identity?.status === "APPROVED" && !identity.reverifyRequiredAt,
  };
}

export async function listOwnReports(userId: number) {
  return prisma.insuranceReport.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, totalArs: true, totalUsd: true, createdAt: true },
  });
}

/** Sólo el dueño: devuelve el informe para descargar el PDF, o null. */
export async function findOwnReport(userId: number, code: string) {
  return prisma.insuranceReport.findFirst({ where: { code, ownerId: userId } });
}
