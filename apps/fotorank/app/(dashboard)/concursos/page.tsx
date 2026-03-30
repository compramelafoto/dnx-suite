import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageContainer } from "../../components/PageContainer";
import { PageInfoRecuadro } from "../../components/ui/PageInfoRecuadro";
import { requireAuth } from "../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../lib/fotorank/dashboard-org-context";
import { getFotorankContests } from "../../lib/fotorank/contests";
import { ConcursosPageClient } from "./ConcursosPageClient";

export const dynamic = "force-dynamic";

export default async function ConcursosPage() {
  const user = await requireAuth();
  const resolved = await resolveActiveOrganizationForUser(user.id);
  if (!resolved.ok) {
    if (resolved.code === "NO_ORGS") redirect("/onboarding");
    return (
      <PageContainer
        title="Concursos"
        description="Gestiona los concursos fotográficos activos e históricos."
      >
        <PageInfoRecuadro variant="warning">
          <p className="fr-body text-amber-100/95">{resolved.error}</p>
        </PageInfoRecuadro>
      </PageContainer>
    );
  }

  const { id: organizationId, name: organizationName } = resolved.org;
  const contests = await getFotorankContests(organizationId);

  return (
    <PageContainer
      title="Concursos"
      description="Gestiona los concursos fotográficos activos e históricos."
    >
      <Suspense fallback={null}>
        <ConcursosPageClient
          contests={contests}
          organizationName={organizationName}
        />
      </Suspense>
    </PageContainer>
  );
}
