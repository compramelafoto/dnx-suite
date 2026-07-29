import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "../../../../../lib/auth";
import { assertOrganizerCanAccessContest } from "../../../../../lib/fotorank/registration";
import { listRulesVersionsForContest } from "../../../../../lib/fotorank/registration";
import { RegistrationError } from "../../../../../lib/fotorank/registration";
import { PageContainer } from "../../../../../components/PageContainer";
import { RulesAdminClient } from "./RulesAdminClient";
import { prisma } from "@repo/db";
import { getPublishedConfiguration } from "../../../../../lib/fotorank/rules-config";

type Props = { params: Promise<{ id: string }> };

export default async function ContestBasesAdminPage({ params }: Props) {
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

  const versions = await listRulesVersionsForContest(contestId);
  const confirmedCount = await prisma.fotorankContestRegistration.count({
    where: { contestId, status: "CONFIRMED" },
  });
  const publishedConfig = await getPublishedConfiguration(contestId);
  const publishedConfigSummary = publishedConfig
    ? [
        `v${publishedConfig.versionNumber} · ${publishedConfig.status}`,
        `nombre: ${publishedConfig.officialName}`,
        `hash: ${publishedConfig.configurationHash.slice(0, 16)}…`,
        `pricing: ${publishedConfig.pricingMode}`,
        `obras: ${publishedConfig.maxEntriesPerRegistration}`,
        `categorías: ${publishedConfig.maxCategoriesPerRegistration}`,
      ].join("\n")
    : null;

  return (
    <PageContainer
      title="Bases del concurso"
      description="Representación textual de una configuración publicada. La IA nunca publica sola."
    >
      <div className="mb-8 flex flex-wrap gap-4">
        <Link href={`/dashboard/concursos/${contestId}`} className="text-sm text-gold hover:text-gold-hover">
          ← Volver al concurso
        </Link>
        <Link
          href={`/dashboard/concursos/${contestId}/configuracion`}
          className="text-sm text-fr-muted hover:text-gold"
        >
          Configuración estructurada
        </Link>
      </div>
      {confirmedCount > 0 ? (
        <p className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Ya hay {confirmedCount} inscripción(es) confirmada(s). Publicar una versión nueva no modifica las
          bases aceptadas por inscripciones anteriores.
        </p>
      ) : null}
      <RulesAdminClient
        contestId={contestId}
        initialVersions={versions}
        publishedConfigSummary={publishedConfigSummary}
      />
    </PageContainer>
  );
}
