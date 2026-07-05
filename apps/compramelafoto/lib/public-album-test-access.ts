import { NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { getAuthUser, type AuthUser } from "@/lib/auth";

/** Mensaje único para bloqueo público de álbumes en modo prueba (API 403). */
export const PUBLIC_TEST_ALBUM_BLOCKED_MESSAGE = "Este álbum está en modo prueba";

/** Error al intentar crear pedidos en álbum TEST (POST precompra). */
export const TEST_ALBUM_NO_ORDERS_MESSAGE =
  "Este proyecto está en modo prueba. No se pueden generar pedidos reales.";

/** Código estable para clientes que traten 403 de modo prueba. */
export const ALBUM_TEST_MODE_ERROR_CODE = "ALBUM_TEST_MODE" as const;

function testAlbumForbiddenResponse(): NextResponse {
  return NextResponse.json(
    {
      error: PUBLIC_TEST_ALBUM_BLOCKED_MESSAGE,
      code: ALBUM_TEST_MODE_ERROR_CODE,
    },
    { status: 403 }
  );
}

function isAlbumOwnerPhotographer(albumUserId: number, userId: number, role: Role): boolean {
  if (userId !== albumUserId) return false;
  return role === Role.PHOTOGRAPHER || role === Role.LAB_PHOTOGRAPHER;
}

/** Dueño fotógrafo de un álbum en modo TEST (para checkout simulado autenticado). */
export function isAlbumTestOwnerPhotographer(
  album: { userId: number; isTest: boolean },
  user: Pick<AuthUser, "id" | "role"> | null | undefined
): boolean {
  if (!user || !album.isTest) return false;
  return isAlbumOwnerPhotographer(album.userId, user.id, user.role);
}

export type TestAlbumPublicGateResult =
  | { ok: true; isTestPreview: boolean }
  | { ok: false; response: NextResponse };

/**
 * Álbumes con `isTest`: solo el fotógrafo dueño autenticado puede acceder (vista simulada).
 * El resto recibe 403 con mensaje fijo.
 */
export async function gateTestAlbumPublicAccess(album: {
  isTest: boolean;
  userId: number;
}): Promise<TestAlbumPublicGateResult> {
  if (!album.isTest) {
    return { ok: true, isTestPreview: false };
  }
  const user = await getAuthUser();
  if (user && isAlbumOwnerPhotographer(album.userId, user.id, user.role)) {
    return { ok: true, isTestPreview: true };
  }
  return {
    ok: false,
    response: testAlbumForbiddenResponse(),
  };
}

export type AlbumTestClientApiRow = {
  isTest: boolean;
  userId: number;
};

/**
 * APIs que reciben `albumId` (no slug): mismo criterio que `gateTestAlbumPublicAccess`.
 * Devuelve `null` si el acceso está permitido; si no, una `NextResponse` 403 lista para devolver.
 * Pasá `preloadedUser` si ya llamaste a `getAuthUser()` en el mismo handler.
 */
export async function denyIfTestAlbumNotOwnerPreview(
  album: AlbumTestClientApiRow | null | undefined,
  preloadedUser?: AuthUser | null
): Promise<NextResponse | null> {
  if (!album) return null;
  if (!album.isTest) return null;
  const user = preloadedUser !== undefined ? preloadedUser : await getAuthUser();
  if (user && isAlbumOwnerPhotographer(album.userId, user.id, user.role)) {
    return null;
  }
  return testAlbumForbiddenResponse();
}

/**
 * Misma regla que `gateTestAlbumPublicAccess`, para páginas server (sin NextResponse).
 * Pasá `preloadedUser` si ya llamaste a `getAuthUser()` en el mismo request.
 */
export async function canPhotographerPreviewTestAlbum(
  album: {
    isTest: boolean;
    userId: number;
  },
  preloadedUser?: AuthUser | null
): Promise<{ allowed: boolean; isTestPreview: boolean }> {
  if (!album.isTest) {
    return { allowed: true, isTestPreview: false };
  }
  const user = preloadedUser !== undefined ? preloadedUser : await getAuthUser();
  if (user && isAlbumOwnerPhotographer(album.userId, user.id, user.role)) {
    return { allowed: true, isTestPreview: true };
  }
  return { allowed: false, isTestPreview: false };
}
