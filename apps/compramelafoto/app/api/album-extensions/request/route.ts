import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  requestAlbumExtension,
  resolveAlbumExtensionRequesterRole,
} from "@/lib/album-extensions/request-album-extension";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const albumId = Number(body?.albumId);
    const daysToAdd = Number.isFinite(Number(body?.daysToAdd)) ? Number(body?.daysToAdd) : 30;

    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "albumId inválido" }, { status: 400 });
    }

    const authUser = await getAuthUser();
    const { requestedByRole, requestedByUserId } = resolveAlbumExtensionRequesterRole(authUser);

    const result = await requestAlbumExtension({
      albumId,
      daysToAdd,
      requestedByRole,
      requestedByUserId,
    });

    return NextResponse.json({
      success: true,
      albumId: result.albumId,
      expirationExtensionDays: result.expirationExtensionDays,
      visibleUntil: result.visibleUntil,
      availableUntil: result.availableUntil,
    });
  } catch (err: unknown) {
    const message = String((err as Error)?.message ?? err);
    if (message === "albumId inválido" || message === "daysToAdd inválido") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message === "Álbum no encontrado") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("POST /api/album-extensions/request ERROR >>>", err);
    return NextResponse.json(
      { error: "Error solicitando extensión", detail: message },
      { status: 500 }
    );
  }
}
