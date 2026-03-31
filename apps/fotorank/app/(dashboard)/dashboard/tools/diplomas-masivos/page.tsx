import type { Metadata } from "next";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../../lib/fotorank/dashboard-org-context";
import { PageContainer } from "../../../../components/PageContainer";
import { DiplomaBatchToolClient } from "./tool-client";

export const metadata: Metadata = {
  title: "Diplomas masivos | Fotorank",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ contestId?: string }>;
};

export default async function DiplomaBatchToolPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) {
    return (
      <PageContainer title="Diplomas masivos" description="Herramienta interna de generación por lotes.">
        <p className="text-sm text-fr-muted">{org.error}</p>
      </PageContainer>
    );
  }

  const params = await searchParams;
  const contestOptions = await prisma.fotorankContest.findMany({
    where: { organizationId: org.org.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      diplomaTemplates: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          layoutJson: true,
          widthPt: true,
          heightPt: true,
          backgroundColor: true,
          backgroundImageUrl: true,
        },
      },
    },
  });

  return (
    <PageContainer title="Generación masiva de diplomas" description="Herramienta interna de acceso directo por URL.">
      <DiplomaBatchToolClient
        contestOptions={contestOptions.map((contest) => ({
          id: contest.id,
          title: contest.title,
          slug: contest.slug,
          templates: contest.diplomaTemplates,
        }))}
        initialContestId={params.contestId ?? null}
      />
    </PageContainer>
  );
}
