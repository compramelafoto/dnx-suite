import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import { doorPathFor } from "@/lib/entrada/institution-door";
import { listUserProfiles } from "@/lib/portal/profiles";
import { setFotofficeWorkspaceCookieOnResponse } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

/**
 * Puerta de una institución → su panel, dejando ESA institución activa.
 *
 * Existe porque la página de la puerta (`../page.tsx`) es un render y no puede escribir
 * cookies. Sin este paso, quien tiene una cookie de institución activa vieja —su estudio
 * propio, por ejemplo— entraba por la puerta de SFPR y el panel le abría el estudio.
 *
 * No otorga nada: la cookie sólo se fija si la persona es equipo de esa institución (según su
 * lista real de perfiles), y el panel sigue autorizando por su cuenta. Cualquier otro caso
 * vuelve a la puerta, que sabe qué decirle.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceSlug: string }> },
) {
  const { workspaceSlug } = await params;
  const back = (path: string) => NextResponse.redirect(new URL(path, request.url));

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true },
  });
  if (!branding) return back("/");

  const user = await getAuthUser();
  if (!user) return back(doorPathFor(workspaceSlug));

  const profiles = await listUserProfiles(user.id);
  const esEquipo = profiles.some(
    (p) => p.kind === "TEAM" && p.workspaceId === branding.workspaceId,
  );
  if (!esEquipo) return back(doorPathFor(workspaceSlug));

  const res = back("/workspace");
  await setFotofficeWorkspaceCookieOnResponse(res, branding.workspaceId);
  return res;
}
