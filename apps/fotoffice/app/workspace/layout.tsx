import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { AdminShell } from "@/components/shell/admin-shell";
import { hasAppAccess, requireAuth } from "@/lib/auth";
import { requireOwnWorkspace } from "@/lib/entrada/require-own-workspace";
import { PORTAL_HOME } from "@/lib/portal/destination";
import { resolveFotofficeUserKind } from "@/lib/portal/user-kind";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  // Frontera con el portal del socio, ANTES de `ensure`: esa función le crearía una
  // institución propia —con rol de dueño— a quien solo es socio de otra.
  if ((await resolveFotofficeUserKind(user.id)) === "MEMBER") redirect(PORTAL_HOME);

  const ensured = await requireOwnWorkspace(user);

  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId: ensured.workspaceId },
    },
    select: { role: true },
  });
  const workspaceRole = membership?.role ?? user.workspaceRole;
  const canAccess =
    user.globalRole === "SUPER_ADMIN" ||
    Boolean(membership) ||
    hasAppAccess({ ...user, workspaceRole }, "FOTOFFICE");
  if (!canAccess) {
    redirect("/login?forbiddenApp=fotoffice");
  }

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: ensured.workspaceId },
    select: { onboardingCompletedAt: true },
  });

  if (!branding?.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
