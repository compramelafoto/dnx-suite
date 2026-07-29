import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "../../../../../lib/auth";
import { assertOrganizerCanAccessContest } from "../../../../../lib/fotorank/registration";
import { RegistrationError } from "../../../../../lib/fotorank/registration";
import { getLatestDraftConfiguration, getPublishedConfiguration } from "../../../../../lib/fotorank/rules-config";
import type { ContestRulesConfiguration } from "../../../../../lib/fotorank/rules-config/types";
import { PageContainer } from "../../../../../components/PageContainer";
import { prisma } from "@repo/db";
import { ConfigurationWizardClient } from "./ConfigurationWizardClient";

type Props = { params: Promise<{ id: string }> };

export default async function ContestConfigurationPage({ params }: Props) {
  const user = await requireAuth();
  const { id: contestId } = await params;

  try {
    await assertOrganizerCanAccessContest(contestId, user.id);
  } catch (err) {
    if (err instanceof RegistrationError && err.code === "FORBIDDEN") redirect("/dashboard");
    if (err instanceof RegistrationError && err.code === "CONTEST_NOT_FOUND") notFound();
    throw err;
  }

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { title: true, slug: true },
  });
  if (!contest) notFound();

  const draft = await getLatestDraftConfiguration(contestId);
  const published = await getPublishedConfiguration(contestId);
  const row = draft ?? published;

  return (
    <PageContainer
      title="Configuración estructurada"
      description="Fuente de verdad del concurso. Las bases textuales se asocian a una versión publicada."
    >
      <div className="mb-8 flex flex-wrap gap-4">
        <Link href={`/dashboard/concursos/${contestId}`} className="text-sm text-gold hover:text-gold-hover">
          ← Volver al concurso
        </Link>
        <Link href={`/dashboard/concursos/${contestId}/bases`} className="text-sm text-fr-muted hover:text-gold">
          Bases versionadas
        </Link>
      </div>
      <ConfigurationWizardClient
        contestId={contestId}
        contestTitle={contest.title}
        initialConfig={(row?.configurationJson as ContestRulesConfiguration | null) ?? null}
        initialVersionId={row?.id ?? null}
        initialVersionNumber={row?.versionNumber ?? null}
        initialStatus={row?.status ?? null}
      />
    </PageContainer>
  );
}
