import { prisma } from "@repo/db";

export type VerificationUiState =
  | "VALID"
  | "INVALID_TOKEN"
  | "NOT_FOUND"
  | "REVOKED"
  | "REPLACED"
  | "FAILED"
  | "INVALID";

export type DiplomaVerificationPayload =
  | {
      state: "VALID";
      contestTitle: string;
      organizerName: string;
      recipientName: string;
      recipientType: string;
      categoryLabel: string | null;
      prizeLabel: string | null;
      diplomaCode: string;
      issuedAtLabel: string;
      statusLabel: string;
    }
  | {
      state: "REVOKED";
      contestTitle: string;
      organizerName: string;
      recipientName: string;
      diplomaCode: string;
      issuedAtLabel: string;
    }
  | {
      state: "REPLACED";
      contestTitle: string;
      organizerName: string;
      recipientName: string;
      diplomaCode: string;
      newVerificationUrl: string | null;
      newDiplomaCode: string | null;
    }
  | {
      state: "FAILED";
      contestTitle: string;
      organizerName: string;
      recipientName: string;
      diplomaCode: string;
    }
  | { state: "NOT_FOUND" }
  | { state: "INVALID_TOKEN" };

function formatIssued(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

export async function getDiplomaVerificationPayload(rawToken: string): Promise<DiplomaVerificationPayload> {
  const token = rawToken?.trim();
  if (!token || token.length < 8 || token.length > 200 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return { state: "INVALID_TOKEN" };
  }

  const row = await prisma.fotorankDiplomaIssued.findUnique({
    where: { verificationToken: token },
    include: {
      contest: { select: { title: true } },
      organization: { select: { name: true } },
      contestCategory: { select: { name: true } },
      replacement: {
        select: { verificationUrl: true, diplomaCode: true, status: true },
      },
    },
  });

  if (!row) return { state: "NOT_FOUND" };

  const base = {
    contestTitle: row.contest.title,
    organizerName: row.organization.name,
    recipientName: row.recipientName,
    diplomaCode: row.diplomaCode,
  };

  if (row.status === "REVOKED") {
    return {
      state: "REVOKED",
      ...base,
      issuedAtLabel: formatIssued(row.renderedAt ?? row.createdAt),
    };
  }

  if (row.status === "REPLACED") {
    const rep = row.replacement;
    return {
      state: "REPLACED",
      ...base,
      newVerificationUrl: rep?.status === "ISSUED" ? rep.verificationUrl : null,
      newDiplomaCode: rep?.status === "ISSUED" ? rep.diplomaCode : null,
    };
  }

  if (row.status === "FAILED") {
    return { state: "FAILED", ...base };
  }

  if (row.status !== "ISSUED") {
    return { state: "NOT_FOUND" };
  }

  return {
    state: "VALID",
    contestTitle: row.contest.title,
    organizerName: row.organization.name,
    recipientName: row.recipientName,
    recipientType: row.recipientType,
    categoryLabel: row.contestCategory?.name ?? null,
    prizeLabel: row.prizeLabel,
    diplomaCode: row.diplomaCode,
    issuedAtLabel: formatIssued(row.renderedAt ?? row.createdAt),
    statusLabel: "Válido",
  };
}
