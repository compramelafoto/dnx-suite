import { prisma } from "@repo/db";
import { Mail } from "lucide-react";
import { requireAuth } from "../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../lib/fotorank/dashboard-org-context";
import { expireStaleDirectoryInvitationsNow } from "../../../lib/fotorank/judges/directoryInvitationService";
import { listProfessionalDirectoryJudges, type DirectoryListFilters } from "../../../lib/fotorank/judges/professionalDirectory";
import {
  DashboardBreadcrumb,
  DashboardPageHeader,
  HeaderSecondaryLink,
} from "../../../components/dashboard-patterns";
import { DirectorioJuradosClient } from "./DirectorioJuradosClient";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DirectorioJuradosPage({ searchParams }: Props) {
  const user = await requireAuth();
  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) {
    return (
      <div className="fr-dashboard-page-shell p-8">
        <p className="text-sm text-fr-muted">{org.error}</p>
      </div>
    );
  }

  const sp = await searchParams;
  const g = (k: string) => (typeof sp[k] === "string" ? sp[k] : undefined);

  const filters: DirectoryListFilters = {
    search: g("q"),
    specialty: g("specialty"),
    language: g("language"),
    country: g("country"),
    region: g("region"),
    availableOnly: g("available") === "1",
    verifiedOnly: g("verified") === "1",
    minExperience: g("minExp") ? Number(g("minExp")) : undefined,
    priceMin: g("pmin") ? Number(g("pmin")) : undefined,
    priceMax: g("pmax") ? Number(g("pmax")) : undefined,
  };
  const comp = g("compensation");
  if (comp === "VOLUNTEER" || comp === "PAID" || comp === "BOTH") filters.compensation = comp;

  await expireStaleDirectoryInvitationsNow();
  const page = Math.max(0, parseInt(g("page") ?? "0", 10) || 0);
  const { items, totalApprox } = await listProfessionalDirectoryJudges(filters, { take: 24, skip: page * 24 });

  const sentInvitesCount = await prisma.fotorankJudgeDirectoryInvitation.count({
    where: { organizationId: org.org.id },
  });

  return (
    <div className="space-y-10">
      <DashboardPageHeader
        eyebrow={
          <DashboardBreadcrumb
            items={[
              { label: "Jurados", href: "/jurados" },
              { label: "Directorio" },
            ]}
          />
        }
        title="Directorio de jurados"
        description="Solo jurados con opt-in al directorio. Sin email ni teléfono en esta vista. Los honorarios se acuerdan fuera de Fotorank."
        actions={
          <HeaderSecondaryLink href="/jurados/directorio/invitaciones" icon={Mail} badgeCount={sentInvitesCount}>
            Invitaciones enviadas
          </HeaderSecondaryLink>
        }
      />

      <DirectorioJuradosClient
        initialItems={items}
        totalApprox={totalApprox}
        initialFilters={filters}
        initialPage={page}
      />
    </div>
  );
}
