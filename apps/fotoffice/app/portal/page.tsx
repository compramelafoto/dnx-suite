import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { resolveFotofficeUserKind } from "@/lib/portal/user-kind";
import { listUserProfiles } from "@/lib/portal/profiles";
import { loadMemberBalance } from "@/lib/membership/balance";
import { getDuesSettings } from "@/lib/membership/settings";
import { describeSeniority } from "@/lib/portal/identity";
import { pendingPrintedCard } from "@/lib/carnet/pending-print";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { resolvePortalMenu } from "@/lib/portal/menu";
import { PortalHome } from "@/components/portal/portal-home";

export const dynamic = "force-dynamic";

/**
 * Portal del socio.
 *
 * Destino real de quien activa su acceso, y frontera con el panel administrativo: acá se
 * entra por tener ficha de socio propia, no por un rol de equipo.
 *
 * Es un tablero: indicadores arriba (cuenta, carnet, categoría, antigüedad), las cuotas y los
 * atajos a la izquierda, el carnet y los avisos a la derecha. La navegación vive en el marco
 * (panel lateral o barra inferior), no en la portada.
 */
export default async function PortalPage() {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);

  if (!context) {
    // Quien no es socio no tiene nada que hacer acá. Si administra una institución se lo
    // devuelve a su panel; si no, al inicio de sesión.
    const kind = await resolveFotofficeUserKind(user.id);
    redirect(kind === "TEAM" ? "/workspace" : "/login");
  }

  const profiles = await listUserProfiles(user.id);
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: context.workspace.id },
    select: { commercialName: true },
  });
  const institution = branding?.commercialName?.trim() || context.workspace.name;
  const cuenta = await loadMemberBalance(context.member.id);
  const antiguedad = describeSeniority(context.member.joinedAt, new Date());
  const v = await loadPersonVocabulary(context.workspace.id);

  // Un pendiente que el socio no ve es un pendiente que no existe: la subida de la foto vive
  // en la pantalla del carnet y nadie llegaba sola hasta ahí.
  const impresa = await pendingPrintedCard(context.member.id);

  // Los 152 socios del padrón migrado llegan sin ninguno de estos datos: nunca hubo un
  // formulario donde cargarlos. El aviso está para eso, y desaparece solo cuando ya cargó algo.
  const perfil = await prisma.member.findUnique({
    where: { id: context.member.id },
    select: {
      businessName: true, bio: true, specialties: true, instagram: true, website: true,
      avatarUrl: true, profilePhotoUrl: true,
    },
  });
  const perfilVacio =
    !perfil?.businessName &&
    !perfil?.bio &&
    !perfil?.instagram &&
    !perfil?.website &&
    (perfil?.specialties.length ?? 0) === 0;

  // Dos interruptores, no uno: el módulo de socios puede estar habilitado y la comisión
  // directiva no haber resuelto todavía dar el beneficio por recomendar.
  const duesSettings = await getDuesSettings(context.workspace.id);
  const secciones = resolvePortalMenu(
    await getEnabledModuleKeysForWorkspace(context.workspace.id),
    { recommendationsEnabled: duesSettings.recommendationEnabled },
  );
  // El mismo item del menú, para no repetir en la portada la regla de cuándo se puede recomendar.
  const recomendar = secciones.some(
    (s) => s.href === "/portal/recomendados" && s.state === "DISPONIBLE",
  );

  return (
    <PortalHome
      institution={institution}
      member={{
        firstName: context.member.firstName,
        fullName: `${context.member.firstName} ${context.member.lastName}`.trim(),
        memberNumber: context.member.memberNumber,
        categoryName: context.member.categoryName ?? null,
        photoUrl: perfil?.profilePhotoUrl ?? perfil?.avatarUrl ?? null,
        businessName: perfil?.businessName?.trim() || null,
      }}
      antiguedad={antiguedad}
      cuenta={cuenta}
      faltaFoto={impresa.pedida && impresa.faltaFoto}
      secciones={secciones}
      vocabulary={v}
      recommendationBenefitPercent={
        recomendar ? duesSettings.recommendationBenefitPercent : null
      }
      perfilVacio={perfilVacio}
      puedeCambiarPerfil={profiles.length > 1}
      tieneNegocio={profiles.some((p) => p.kind === "TEAM")}
    />
  );
}
