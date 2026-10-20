import { prisma } from "@/lib/prisma";
import { memberCanUpload, memberNeedsTerms } from "@/lib/agencies/rules";
import { ensureMpConnected } from "@/app/api/dashboard/albums/[id]/photos/upload-helpers";
import { FLUX_MESSAGES, authorizeFluxRequest, fluxError, fluxJson } from "@/lib/agencies/flux-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DNX FLUX: agencias activas del fotógrafo con sus álbumes (el más nuevo primero) y lugares. Sin datos de clientes. */
export async function GET(request: Request) {
  const a = await authorizeFluxRequest(request);
  if ("res" in a) return a.res;
  try {
    const [user, memberships, mp] = await Promise.all([
      prisma.user.findUnique({ where: { id: a.ctx.userId }, select: { name: true } }),
      prisma.agencyMember.findMany({
        where: { userId: a.ctx.userId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: {
          status: true,
          termsVersionAccepted: true,
          agency: {
            select: {
              id: true, name: true, logoUrl: true, termsVersion: true,
              albums: {
                where: { album: { deletedAt: null } },
                orderBy: { createdAt: "desc" },
                select: { albumId: true, album: { select: { title: true } } },
              },
              places: { orderBy: { name: "asc" }, select: { id: true, name: true, lat: true, lng: true } },
            },
          },
        },
      }),
      ensureMpConnected({ id: a.ctx.userId, role: a.ctx.role }),
    ]);
    return fluxJson({
      user: { name: user?.name ?? null },
      mpConnected: mp.ok,
      agencies: memberships.map((m) => ({
        agencyId: m.agency.id,
        name: m.agency.name,
        logoUrl: m.agency.logoUrl,
        canUpload: memberCanUpload(m, m.agency),
        needsTerms: memberNeedsTerms(m, m.agency),
        albums: m.agency.albums.map((al) => ({ albumId: al.albumId, title: al.album.title })),
        places: m.agency.places,
      })),
    });
  } catch {
    return fluxError(FLUX_MESSAGES.error, 503);
  }
}
