import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { isAlbumPubliclyAccessible, isAlbumUnlistedWithDirectLink } from "@/lib/album-helpers";
import { gateTestAlbumPublicAccess } from "@/lib/public-album-test-access";
import { HIDDEN_ALBUM_GRANT_COOKIE, parseGrantCookie } from "@/lib/hidden-album-audit";

export type AlbumForPublicVideoAccess = {
  id: number;
  userId: number;
  isTest: boolean;
  isPublic: boolean | null;
  isHidden: boolean | null;
  hiddenPhotosEnabled?: boolean | null;
};

export type AlbumPublicVideoAccessContext = {
  canViewPrivateAlbum: boolean;
  isPubliclyAccessible: boolean;
  /** Visitantes sin privilegio: ocultar videos vencidos por expiresAt. */
  applyExpiresFilter: boolean;
};

export async function resolveAlbumPublicVideoAccess(
  req: NextRequest,
  album: AlbumForPublicVideoAccess
): Promise<
  | { ok: true; access: AlbumPublicVideoAccessContext }
  | { ok: false; response: NextResponse }
> {
  const testGate = await gateTestAlbumPublicAccess({
    isTest: album.isTest,
    userId: album.userId,
  });
  if (!testGate.ok) {
    return { ok: false, response: testGate.response };
  }

  const authUser = await getAuthUser();
  const albumAccess =
    authUser != null
      ? await prisma.albumAccess.findUnique({
          where: { albumId_userId: { albumId: album.id, userId: authUser.id } },
        })
      : null;

  const canViewPrivateAlbum = Boolean(
    authUser &&
      (authUser.id === album.userId ||
        authUser.role === Role.ADMIN ||
        albumAccess)
  );

  const isPubliclyAccessible = isAlbumPubliclyAccessible(album);
  const isUnlistedDirectLink = isAlbumUnlistedWithDirectLink(album);

  if (isPubliclyAccessible || isUnlistedDirectLink || canViewPrivateAlbum) {
    return {
      ok: true,
      access: {
        canViewPrivateAlbum,
        isPubliclyAccessible,
        applyExpiresFilter: !canViewPrivateAlbum,
      },
    };
  }

  if (album.hiddenPhotosEnabled) {
    const grantCookie = req.cookies.get(HIDDEN_ALBUM_GRANT_COOKIE)?.value ?? null;
    const parsed = parseGrantCookie(grantCookie);
    if (parsed?.albumId === album.id) {
      const grant = await prisma.hiddenAlbumGrant.findUnique({
        where: { id: parsed.grantId },
        select: { albumId: true, expiresAt: true, isRevoked: true },
      });
      if (
        grant &&
        grant.albumId === album.id &&
        !grant.isRevoked &&
        grant.expiresAt >= new Date()
      ) {
        return {
          ok: true,
          access: {
            canViewPrivateAlbum: false,
            isPubliclyAccessible: false,
            applyExpiresFilter: true,
          },
        };
      }
    }
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Álbum no disponible" }, { status: 403 }),
  };
}
