import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { resolveFotofficeUserKind } from "@/lib/portal/user-kind";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { resolvePortalMenu } from "@/lib/portal/menu";
import { PortalShell } from "@/components/portal/portal-shell";

/**
 * El marco de todo el portal.
 *
 * Está acá y no en cada pantalla por lo que pasaba antes: el encabezado con la identidad del
 * socio y la navegación existían solo en la portada. Quien entraba a sus cuotas o a su carnet
 * se quedaba sin saber quién es ni cómo volver, y cada pantalla nueva tenía que acordarse de
 * montarlo. En un layout no se puede olvidar.
 *
 * La comprobación de acceso también vive acá, por el mismo motivo: es una sola, corre en el
 * servidor y cubre todo lo que cuelgue de `/portal`, incluida cualquier pantalla futura.
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);

  if (!context) {
    // Quien no es socio no tiene nada que hacer acá. Si administra una institución se lo
    // devuelve a su panel; si no, al inicio de sesión.
    const kind = await resolveFotofficeUserKind(user.id);
    redirect(kind === "TEAM" ? "/workspace" : "/login");
  }

  const [branding, foto, enabledModuleKeys] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: context.workspace.id },
      select: { commercialName: true, logoUrl: true },
    }),
    prisma.member.findUnique({
      where: { id: context.member.id },
      select: { avatarUrl: true, profilePhotoUrl: true },
    }),
    getEnabledModuleKeysForWorkspace(context.workspace.id),
  ]);

  return (
    <PortalShell
      items={resolvePortalMenu(enabledModuleKeys)}
      institution={{
        name: branding?.commercialName?.trim() || context.workspace.name,
        logoUrl: branding?.logoUrl ?? null,
      }}
      member={{
        fullName: `${context.member.firstName} ${context.member.lastName}`.trim(),
        memberNumber: context.member.memberNumber,
        category: context.member.categoryName ?? null,
        // Vacío significa "usar la del carnet": nadie tiene que elegir una foto para tener una.
        photoUrl: foto?.profilePhotoUrl ?? foto?.avatarUrl ?? null,
      }}
    >
      {children}
    </PortalShell>
  );
}
