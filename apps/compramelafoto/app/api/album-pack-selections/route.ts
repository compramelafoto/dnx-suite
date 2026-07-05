import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  AlbumPackSelectionRuleError,
  validateAlbumPackSelectionInput,
} from "@/lib/album-packs/album-pack-selection-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseBody(body: unknown): {
  albumId: number;
  albumPackId: string;
  photoIds: number[];
  guestToken: string | null;
  buyerEmail: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
} {
  const payload = (body ?? {}) as Record<string, unknown>;
  const albumId = Number(payload.albumId);
  const albumPackId = String(payload.albumPackId ?? "").trim();
  const photoIds = Array.isArray(payload.photoIds) ? payload.photoIds.map((v) => Number(v)) : [];
  const guestTokenRaw = payload.guestToken;
  const buyerEmailRaw = payload.buyerEmail;
  const buyerNameRaw = payload.buyerName;
  const buyerPhoneRaw = payload.buyerPhone;

  if (!Number.isInteger(albumId) || albumId <= 0) {
    throw new AlbumPackSelectionRuleError("albumId inválido.", "ALBUM_ID_INVALID");
  }
  if (!albumPackId) {
    throw new AlbumPackSelectionRuleError("albumPackId es obligatorio.", "PACK_ID_REQUIRED");
  }

  return {
    albumId,
    albumPackId,
    photoIds,
    guestToken:
      guestTokenRaw == null || String(guestTokenRaw).trim() === ""
        ? null
        : String(guestTokenRaw).trim(),
    buyerEmail:
      buyerEmailRaw == null || String(buyerEmailRaw).trim() === ""
        ? null
        : String(buyerEmailRaw).trim().toLowerCase(),
    buyerName:
      buyerNameRaw == null || String(buyerNameRaw).trim() === ""
        ? null
        : String(buyerNameRaw).trim(),
    buyerPhone:
      buyerPhoneRaw == null || String(buyerPhoneRaw).trim() === ""
        ? null
        : String(buyerPhoneRaw).trim(),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = parseBody(body);
    const authUser = await getAuthUser();

    const { pack, photoIds } = await validateAlbumPackSelectionInput({
      albumId: parsed.albumId,
      albumPackId: parsed.albumPackId,
      photoIds: parsed.photoIds,
      countMode: "max",
    });

    const guestToken = parsed.guestToken ?? randomUUID();
    const created = await prisma.albumPackSelectionSession.create({
      data: {
        albumId: parsed.albumId,
        albumPackId: pack.id,
        guestToken,
        buyerEmail: parsed.buyerEmail ?? authUser?.email?.toLowerCase() ?? null,
        buyerName: parsed.buyerName ?? authUser?.name ?? null,
        buyerPhone: parsed.buyerPhone,
        status: "DRAFT",
        photos: {
          createMany: {
            data: photoIds.map((photoId, idx) => ({
              photoId,
              position: idx,
            })),
          },
        },
      },
      include: {
        albumPack: true,
        photos: {
          include: { photo: { select: { id: true, previewUrl: true, originalKey: true } } },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    return NextResponse.json(
      {
        session: created,
        guestToken,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AlbumPackSelectionRuleError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("POST /api/album-pack-selections", err);
    return NextResponse.json(
      { error: "Error al crear sesión de selección de pack." },
      { status: 500 }
    );
  }
}
