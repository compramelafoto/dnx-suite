import { prisma } from "@/lib/admin/db";

export type FinanceRecipientAccountOption = {
  id: string;
  environment: string;
  status: string;
  canReceive: boolean;
  label: string;
};

export type FinanceRecipientOption = {
  financialIdentityId: string;
  label: string;
  emailMasked: string | null;
  subjectType: string;
  accounts: FinanceRecipientAccountOption[];
};

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [u, d] = email.split("@");
  if (!u || !d) return "***";
  return `${u.slice(0, 2)}•••@${d}`;
}

function canReceive(account: {
  status: string;
  capabilities: string[];
}): boolean {
  return (
    account.status === "ACTIVE" &&
    (account.capabilities.includes("COLLECTOR") ||
      account.capabilities.includes("SPLIT_RECEIVER") ||
      account.capabilities.length === 0)
  );
}

export async function listActiveFinanceRecipientsForPicker(): Promise<
  FinanceRecipientOption[]
> {
  const rows = await prisma.dnxFinancialIdentity.findMany({
    where: { status: "ACTIVE" },
    include: {
      ownerUser: { select: { id: true, email: true } },
      paymentAccounts: {
        where: { status: { in: ["ACTIVE", "PENDING", "NEEDS_REAUTH"] } },
        orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
      },
    },
    orderBy: { legalName: "asc" },
  });

  return rows.map((row) => ({
    financialIdentityId: row.id,
    label:
      row.legalName?.trim() ||
      row.ownerUser?.email ||
      `${row.subjectType} ${row.id.slice(0, 8)}`,
    emailMasked: maskEmail(row.ownerUser?.email),
    subjectType: row.subjectType,
    accounts: row.paymentAccounts.map((acc) => ({
      id: acc.id,
      environment: acc.environment,
      status: acc.status,
      canReceive: canReceive(acc),
      label: `${acc.environment} · ${acc.status} · ${acc.providerUserId ?? acc.id.slice(0, 8)}`,
    })),
  }));
}
