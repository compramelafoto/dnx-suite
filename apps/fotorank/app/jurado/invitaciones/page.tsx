import Link from "next/link";
import { requireJudgeAuth } from "../../lib/judge-auth";
import { expireStaleDirectoryInvitationsNow } from "../../lib/fotorank/judges/directoryInvitationService";
import { prisma } from "@repo/db";
import { JudgeDirectoryInvitationsClient } from "./JudgeDirectoryInvitationsClient";

export const dynamic = "force-dynamic";

export default async function JuradoInvitacionesPage() {
  const judge = await requireJudgeAuth();
  await expireStaleDirectoryInvitationsNow();
  const rows = await prisma.fotorankJudgeDirectoryInvitation.findMany({
    where: { judgeAccountId: judge.id, status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      contest: { select: { title: true } },
      organization: { select: { name: true } },
    },
  });

  const initial = rows.map((r) => ({
    id: r.id,
    status: r.status,
    message: r.message,
    contestTitle: r.contest.title,
    orgName: r.organization.name,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt?.toISOString() ?? null,
    proposedRoleLabel: r.proposedRoleLabel,
    compensationOfferedText: r.compensationOfferedText,
  }));

  return (
    <div className="min-h-screen bg-fr-bg px-4 py-10 text-fr-primary md:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-sans text-2xl font-semibold tracking-tight">Invitaciones recibidas</h1>
            <p className="mt-2 text-sm text-fr-muted">Desde el directorio profesional de Fotorank.</p>
          </div>
          <Link href="/jurado/panel" className="fr-btn fr-btn-secondary text-sm self-start">
            Panel
          </Link>
        </div>
        <JudgeDirectoryInvitationsClient initial={initial} />
      </div>
    </div>
  );
}
