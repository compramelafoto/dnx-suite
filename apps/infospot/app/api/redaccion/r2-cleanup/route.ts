import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canManageInfoSpotSettings,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { getAuthUser } from "@/lib/auth";
import {
  deleteInfoSpotR2Keys,
  purgeEditorialAssetR2Storage,
  purgeEditorialPhotoR2Storage,
} from "@/lib/r2-cleanup";
import { INFOSPOT_R2_DELETE_BATCH_MAX } from "@/lib/r2-key-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cleanup R2 autenticado (solo Dirección).
 * No es público: requiere sesión + canManageInfoSpotSettings.
 * Las keys se validan contra el namespace Info Spot; no hay borrado por prefijo.
 *
 * Body:
 * - { mode: "keys", keys: string[] }
 * - { mode: "editorialPhoto", photoId: string }
 * - { mode: "asset", assetId: string }
 */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const membership = await getInfoSpotMembership(user.id);
  const subject = toPermissionSubject(user, membership);
  if (!canManageInfoSpotSettings(subject)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const schema = z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("keys"),
      keys: z.array(z.string().min(1).max(512)).min(1).max(INFOSPOT_R2_DELETE_BATCH_MAX),
    }),
    z.object({
      mode: z.literal("editorialPhoto"),
      photoId: z.string().min(1).max(64),
    }),
    z.object({
      mode: z.literal("asset"),
      assetId: z.string().min(1).max(64),
    }),
  ]);

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (parsed.data.mode === "keys") {
    const result = await deleteInfoSpotR2Keys(parsed.data.keys);
    return NextResponse.json(
      {
        ok: result.ok,
        mode: "keys",
        deletedCount: result.deletedCount,
        results: result.results,
        error: result.error,
      },
      { status: result.ok ? 200 : 422 },
    );
  }

  if (parsed.data.mode === "editorialPhoto") {
    const result = await purgeEditorialPhotoR2Storage(parsed.data.photoId);
    return NextResponse.json(
      {
        ok: result.ok,
        mode: "editorialPhoto",
        photoId: result.photoId,
        keys: result.keys,
        deletedCount: result.deletedCount,
        error: result.error,
      },
      { status: result.ok ? 200 : result.error === "Foto editorial no encontrada" ? 404 : 422 },
    );
  }

  const result = await purgeEditorialAssetR2Storage(parsed.data.assetId);
  return NextResponse.json(
    {
      ok: result.ok,
      mode: "asset",
      assetId: result.assetId,
      keys: result.keys,
      deletedCount: result.deletedCount,
      skippedCount: result.skippedCount,
      error: result.error,
    },
    { status: result.ok ? 200 : result.error === "Asset no encontrado" ? 404 : 422 },
  );
}
