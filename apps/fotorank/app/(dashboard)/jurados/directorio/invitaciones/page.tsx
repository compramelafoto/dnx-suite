import Link from "next/link";
import { requireAuth } from "../../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../../lib/fotorank/dashboard-org-context";
import { expireStaleDirectoryInvitationsNow } from "../../../../lib/fotorank/judges/directoryInvitationService";
import { prisma } from "@repo/db";
import { SentDirectoryInvitationsClient } from "./SentDirectoryInvitationsClient";

export const dynamic = "force-dynamic";

export default async function SentDirectoryInvitationsPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) {
    return (
      <div className="p-8">
        <p className="text-sm text-fr-muted">{org.error}</p>
      </div>
    );
  }

  await expireStaleDirectoryInvitationsNow();
  const rows = await prisma.fotorankJudgeDirectoryInvitation.findMany({
    where: { organizationId: org.org.id },
    orderBy: { createdAt: "desc" },
    take: 120,
    include: {
      contest: { select: { title: true } },
      judgeAccount: { include: { profile: true } },
    },
  });

  const initial = rows.map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    contestTitle: r.contest.title,
    judgeLabel: r.judgeAccount.profile
      ? `${r.judgeAccount.profile.firstName} ${r.judgeAccount.profile.lastName}`.trim()
      : r.judgeAccount.email,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl font-semibold text-fr-primary">Invitaciones (directorio)</h1>
          <p className="mt-2 text-sm text-fr-muted">Enviadas desde el directorio profesional.</p>
        </div>
        <Link href="/jurados/directorio" className="fr-btn fr-btn-secondary text-sm">
          Volver al directorio
        </Link>
      </div>
      <SentDirectoryInvitationsClient initial={initial} />
    </div>
  );
}
