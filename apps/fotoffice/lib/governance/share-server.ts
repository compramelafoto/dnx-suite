import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { getAuthUser } from "@/lib/auth";
import { doorPathFor } from "@/lib/entrada/institution-door";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { listUserProfiles } from "@/lib/portal/profiles";
import { PROFILE_CHOICE_COOKIE } from "@/lib/portal/profile-choice";
import { setFotofficeWorkspaceCookieOnResponse } from "@/lib/session-cookie";
import { GOVERNANCE_MODULE_KEY } from "./constants";
import { decideSharedDestination, isValidSharedParams, sharedPath, sharedUrl, type SharedKind } from "./share";

/**
 * Lo que hace falta para armar el enlace de una institución: su dirección pública y, si lo tiene
 * conectado, su dominio propio. `null` si la institución no tiene dirección pública (sin slug no
 * hay enlace que compartir).
 */
export async function loadShareBase(workspaceId: string): Promise<{ slug: string; customDomain: string | null } | null> {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId },
    select: { publicSlug: true },
  });
  if (!branding?.publicSlug) return null;
  // Si la tabla del dominio no estuviera, el enlace sale igual por FOTOFFICE.
  const domain = await prisma.fotofficeWorkspaceDomain
    .findUnique({ where: { workspaceId }, select: { domain: true, status: true } })
    .catch(() => null);
  return { slug: branding.publicSlug, customDomain: domain?.status === "CONNECTED" ? domain.domain : null };
}

export function buildSharedUrl(kind: SharedKind, id: string, base: { slug: string; customDomain: string | null }): string {
  return sharedUrl({ kind, id, slug: base.slug, customDomain: base.customDomain, appOrigin: appUrl() });
}

/**
 * El enlace compartido, abierto: lleva a cada uno a su lugar. Lo usan las dos rutas
 * `app/w/[workspaceSlug]/{proyecto,reunion}/[id]`.
 *
 * Fija la institución activa (comisión) o la ficha elegida (socio) antes de redirigir, como hace
 * `entrar/panel`: si no, quien es de dos instituciones abriría el enlace en la otra y vería
 * "no existe". No otorga nada; el panel y el portal autorizan por su cuenta.
 */
export async function openSharedLink(request: Request, kind: SharedKind, slug: string, id: string): Promise<NextResponse> {
  const ir = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (!isValidSharedParams(slug, id)) return ir("/");

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: slug },
    select: { workspaceId: true },
  });
  if (!branding) return ir("/");
  const workspaceId = branding.workspaceId;

  const existe =
    kind === "proyecto"
      ? await prisma.govProject.findFirst({ where: { id, workspaceId }, select: { id: true } })
      : await prisma.govMeeting.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!existe) return ir(`/w/${slug}`);

  const user = await getAuthUser();
  if (!user) return ir(`/login?next=${encodeURIComponent(sharedPath(kind, slug, id))}`);

  const profiles = await listUserProfiles(user.id);
  const esEquipo = profiles.some((p) => p.kind === "TEAM" && p.workspaceId === workspaceId);
  const commission = esEquipo && hasLevel(await getModuleLevel(user.id, workspaceId, GOVERNANCE_MODULE_KEY), "VIEW");
  const ficha = profiles.find((p) => p.kind === "MEMBER" && p.workspaceId === workspaceId);
  const memberId = ficha?.kind === "MEMBER" ? ficha.memberId : null;

  const memberCanSee =
    kind === "proyecto" && memberId !== null
      ? Boolean(
          await prisma.govProject.findFirst({
            where: {
              id,
              workspaceId,
              OR: [{ visibleToMembers: true, status: { notIn: ["MEMBER_PROPOSAL", "ARCHIVED"] } }, { proposedByMemberId: memberId }],
            },
            select: { id: true },
          }),
        )
      : false;

  const destino = decideSharedDestination({ kind, id, viewer: { commission, memberId }, memberCanSee });
  if (destino.kind === "door") return ir(doorPathFor(slug));

  const res = ir(destino.path);
  if (destino.kind === "panel") {
    await setFotofficeWorkspaceCookieOnResponse(res, workspaceId);
  } else {
    res.cookies.set(PROFILE_CHOICE_COOKIE, `MEMBER:${workspaceId}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 90 * 24 * 60 * 60,
    });
  }
  return res;
}
