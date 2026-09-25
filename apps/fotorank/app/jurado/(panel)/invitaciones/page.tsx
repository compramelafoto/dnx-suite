import { requireJudgeAuth } from "../../../lib/judge-auth";
import { expireStaleDirectoryInvitationsNow } from "../../../lib/fotorank/judges/directoryInvitationService";
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
    <div className="text-fr-primary">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <p className="fr-eyebrow text-gold">Como jurado</p>
          <h1 className="mt-2 font-sans text-2xl font-semibold tracking-tight">Invitaciones recibidas</h1>
          <p className="mt-2 text-sm text-fr-muted">Desde el directorio profesional de FotoRank.</p>
        </div>
        <JudgeDirectoryInvitationsClient initial={initial} />
      </div>
    </div>
  );
}
