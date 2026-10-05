import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { resolvePortalViewer } from "@/lib/portal/viewer";
import { resolveFotofficeUserKind } from "@/lib/portal/user-kind";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { resolvePortalMenu, resolveStudentPortalMenu } from "@/lib/portal/menu";
import { getDuesSettings } from "@/lib/membership/settings";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { rutaAsociarse } from "@/lib/course-classroom/asociarse";
import { PortalShell } from "@/components/portal/portal-shell";
import { listUserProfiles, roleSelector } from "@/lib/portal/profiles";

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
  const viewer = await resolvePortalViewer(user.id);

  if (!viewer) {
    // Ni socio ni alumno: no tiene nada que hacer acá. Si administra una institución se lo
    // devuelve a su panel; si no, al inicio de sesión.
    const kind = await resolveFotofficeUserKind(user.id);
    redirect(kind === "TEAM" ? "/workspace" : "/login");
  }

  // El alumno no lleva selector de rol: sin ficha de socio activa, `roleSelector` no tiene
  // nada entre qué alternar (exige socio Y equipo en la misma institución).
  if (viewer.kind === "STUDENT") {
    const [branding, vocabulary] = await Promise.all([
      prisma.fotofficeWorkspaceBranding.findUnique({
        where: { workspaceId: viewer.workspace.id },
        select: { commercialName: true, logoUrl: true },
      }),
      loadPersonVocabulary(viewer.workspace.id),
    ]);
    return (
      <PortalShell
        items={resolveStudentPortalMenu({ asociarseHref: await rutaAsociarse(viewer.workspace.id, viewer.userId) })}
        vocabulary={vocabulary}
        institution={{
          name: branding?.commercialName?.trim() || viewer.workspace.name,
          logoUrl: branding?.logoUrl ?? null,
        }}
        member={{ fullName: viewer.fullName, memberNumber: null, category: null, photoUrl: null }}
      >
        {children}
      </PortalShell>
    );
  }

  const context = viewer.context;

  const [branding, foto, enabledModuleKeys, duesSettings, vocabulary, perfiles] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: context.workspace.id },
      select: { commercialName: true, logoUrl: true },
    }),
    prisma.member.findUnique({
      where: { id: context.member.id },
      select: { avatarUrl: true, profilePhotoUrl: true },
    }),
    getEnabledModuleKeysForWorkspace(context.workspace.id),
    getDuesSettings(context.workspace.id),
    loadPersonVocabulary(context.workspace.id),
    listUserProfiles(user.id),
  ]);
  // Si el socio también es equipo de ESTA institución, el selector de rol lo lleva al panel.
  const selector = roleSelector(perfiles, { kind: "MEMBER", workspaceId: context.workspace.id }, vocabulary);

  return (
    <PortalShell
      items={resolvePortalMenu(enabledModuleKeys, {
        recommendationsEnabled: duesSettings.recommendationEnabled,
      })}
      vocabulary={vocabulary}
      roleSelector={selector}
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
