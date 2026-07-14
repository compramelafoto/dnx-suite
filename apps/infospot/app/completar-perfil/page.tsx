import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { PageShell } from "@/components/page-shell";
import { requireAuth } from "@/lib/auth";
import {
  detectClfCapabilities,
  hasActivePublicProfile,
  isOnboardingComplete,
} from "@/lib/dnx-user-profiles";
import { findInfoSpotPendingInvitation } from "@/lib/google-login";
import {
  canAccessInfoSpotAdmin,
  canAccessInfoSpotRedaccion,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { CompletarPerfilForm } from "./completar-perfil-form";

export const metadata: Metadata = {
  title: "Completar perfil",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ invitacion?: string }>;

export default async function CompletarPerfilPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireAuth();
  const membership = await getInfoSpotMembership(user.id);
  const subject = toPermissionSubject(user, membership);
  const hasEditorial =
    user.globalRole === "SUPER_ADMIN" ||
    canAccessInfoSpotRedaccion(subject) ||
    canAccessInfoSpotAdmin(subject);

  const completed = await isOnboardingComplete(user.id);
  const hasProfiles = await hasActivePublicProfile(user.id);
  if ((completed && hasProfiles) || hasEditorial) {
    redirect(hasEditorial ? "/redaccion" : "/");
  }

  const params = await searchParams;
  const pendingInvite = await findInfoSpotPendingInvitation(user.email);
  const clf = await detectClfCapabilities(user.id);
  const categories = await prisma.infoSpotCategory.findMany({
    orderBy: { name: "asc" },
    select: { slug: true, name: true },
    take: 24,
  });

  return (
    <PageShell
      title="¿Cómo querés usar Info Spot?"
      description="Elegí todo lo que te represente. Podrás cambiarlo más adelante."
    >
      <CompletarPerfilForm
        categories={categories}
        showInviteHint={Boolean(pendingInvite) || params.invitacion === "1"}
        clfPhotographer={clf.photographer}
        clfOrganizer={clf.organizer}
      />
    </PageShell>
  );
}
