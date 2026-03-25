import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  hashIp,
  getOrCreateGuestId,
  getDeviceType,
  getClientIp,
  truncateUserAgent,
  guestIdCookieHeader,
  HIDDEN_ALBUM_GRANT_COOKIE,
} from "@/lib/hidden-album-audit";
import { detectFaceCount, searchFacesByImage } from "@/lib/faces/rekognition";
import { uploadToR2, generateR2Key } from "@/lib/r2-client";
import { HiddenAlbumAttemptResult, HiddenAlbumDeviceType } from "@prisma/client";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRANT_TTL_MS = 30 * 60 * 1000; // 30 min
const SELFIE_MAX_BYTES = 10 * 1024 * 1024; // 10MB

/** Extrae los bytes de la selfie desde un FormData ya leído (evita leer el body dos veces). */
function getSelfieImageFromForm(form: FormData): Promise<Buffer> {
  const file = form.get("selfie") || form.get("file");
  if (file && file instanceof File) {
    return file.arrayBuffer().then((ab) => Buffer.from(ab));
  }
  throw new Error("Se requiere campo 'selfie' o 'file' con la imagen");
}

function signGrantToken(grantId: string, albumId: number, expiresAt: number): string {
  const secret = process.env.HIDDEN_ALBUM_GRANT_SECRET || process.env.CRON_SECRET || "grant-secret";
  const payload = `${grantId}:${albumId}:${expiresAt}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

/**
 * POST /api/albums/[id]/hidden/selfie
 * Verificación por selfie para álbum con fotos ocultas. Crea attempt (auditoría) y grant (autorización).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const startTotal = Date.now();
  const { id } = await Promise.resolve(params);
  const albumId = parseInt(id, 10);
  if (!Number.isFinite(albumId)) {
    return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
  }

  // Clonar la request y leer el body solo del clone (evita que middleware/framework consuma el body antes)
  const contentType = req.headers.get("content-type") || "";
  let qrSessionId: string | null = null;
  let imageBytes: Buffer;
  try {
    if (contentType.includes("multipart/form-data")) {
      const reqToRead = req.clone();
      const form = await reqToRead.formData();
      qrSessionId = form.get("qrSessionId")?.toString()?.trim() || null;
      imageBytes = await getSelfieImageFromForm(form);
    } else {
      const reqToRead = req.clone();
      const body = await reqToRead.json();
      const url = body?.imageUrl?.trim?.();
      if (!url) {
        return NextResponse.json({ error: "Se requiere multipart con 'selfie' o JSON con imageUrl" }, { status: 400 });
      }
      const r = await fetch(url);
      if (!r.ok) throw new Error("No se pudo descargar la imagen");
      imageBytes = Buffer.from(await r.arrayBuffer());
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message?.includes("already been read") ? "Error al leer la imagen. Intentá de nuevo." : e?.message || "Se requiere la selfie." },
      { status: 400 }
    );
  }

  if (imageBytes.length > SELFIE_MAX_BYTES) {
    return NextResponse.json({ error: "La imagen no puede superar 10 MB" }, { status: 400 });
  }

  const user = await getAuthUser();
  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const userAgent = truncateUserAgent(req.headers.get("user-agent"));
  const deviceType: HiddenAlbumDeviceType = getDeviceType(req.headers.get("user-agent"));
  const guestId = user ? undefined : getOrCreateGuestId(req);
  const userId = user?.id ?? null;

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, userId: true, hiddenPhotosEnabled: true, hiddenSelfieRetentionDays: true },
  });

  if (!album) {
    return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
  }
  if (!album.hiddenPhotosEnabled) {
    return NextResponse.json({ error: "Este álbum no tiene fotos ocultas por selfie" }, { status: 400 });
  }

  // 1) Crear attempt al inicio (estado provisional)
  const attempt = await prisma.hiddenAlbumAttempt.create({
    data: {
      albumId,
      userId,
      guestId: guestId ?? null,
      qrSessionId,
      ipHash,
      userAgent,
      deviceType,
      result: HiddenAlbumAttemptResult.ERROR,
      facesInSelfieCount: 0,
    },
  });

  // 2) Rate limit (por album + ip hash)
  const rate = checkRateLimit({
    key: `hidden-selfie:${albumId}:${ipHash}`,
    limit: 15,
    windowMs: 60 * 1000,
  });
  if (!rate.allowed) {
    await prisma.hiddenAlbumAttempt.update({
      where: { id: attempt.id },
      data: { result: HiddenAlbumAttemptResult.RATE_LIMITED },
    });
    return NextResponse.json(
      { error: "Demasiados intentos. Intentá de nuevo en un minuto." },
      { status: 429 }
    );
  }

  const u8 = new Uint8Array(imageBytes);

  // 3) Validar sesión QR (stub: si en el futuro hay expiración, setear EXPIRED_SESSION)
  // if (qrSessionId && isExpired(qrSessionId)) { ... result: EXPIRED_SESSION; return 403; }

  // 4) Contar caras en la selfie
  let faceCount: number;
  try {
    faceCount = await detectFaceCount(u8);
  } catch (err: any) {
    await prisma.hiddenAlbumAttempt.update({
      where: { id: attempt.id },
      data: {
        result: HiddenAlbumAttemptResult.ERROR,
        errorCode: "DETECT_FACES_FAILED",
        errorMessage: String(err?.message ?? err).slice(0, 512),
        durationMs: Date.now() - startTotal,
      },
    });
    return NextResponse.json(
      { error: "Error al analizar la imagen" },
      { status: 500 }
    );
  }

  if (faceCount === 0) {
    await prisma.hiddenAlbumAttempt.update({
      where: { id: attempt.id },
      data: {
        result: HiddenAlbumAttemptResult.NO_FACE,
        facesInSelfieCount: 0,
        durationMs: Date.now() - startTotal,
      },
    });
    return NextResponse.json(
      { error: "No se detectó ninguna cara. Asegurate de que se vea tu rostro." },
      { status: 400 }
    );
  }

  if (faceCount > 1) {
    await prisma.hiddenAlbumAttempt.update({
      where: { id: attempt.id },
      data: {
        result: HiddenAlbumAttemptResult.MULTIPLE_FACES,
        facesInSelfieCount: faceCount,
        durationMs: Date.now() - startTotal,
      },
    });
    return NextResponse.json(
      { error: "Se detectó más de una cara. Por favor subí una selfie solo con tu rostro." },
      { status: 400 }
    );
  }

  // 5) Una cara: buscar coincidencias en la colección y armar allowedPhotoIds
  let matches: { rekognitionFaceId: string; similarity?: number | null }[];
  try {
    matches = await searchFacesByImage(u8);
  } catch (err: any) {
    await prisma.hiddenAlbumAttempt.update({
      where: { id: attempt.id },
      data: {
        result: HiddenAlbumAttemptResult.ERROR,
        errorCode: "SEARCH_FACES_FAILED",
        errorMessage: String(err?.message ?? err).slice(0, 512),
        facesInSelfieCount: 1,
        durationMs: Date.now() - startTotal,
      },
    });
    return NextResponse.json(
      { error: "Error al buscar coincidencias" },
      { status: 500 }
    );
  }

  const matchFaceIds = new Set(matches.map((m) => m.rekognitionFaceId));
  const bestMatchConfidence =
    matches.length > 0
      ? Math.max(...matches.map((m) => m.similarity ?? 0))
      : null;

  // Fotos del álbum no eliminadas
  const albumPhotos = await prisma.photo.findMany({
    where: { albumId, isRemoved: false },
    select: { id: true },
  });
  const allPhotoIds = albumPhotos.map((p) => p.id);

  // Caras indexadas por foto en este álbum
  const detections = await prisma.faceDetection.findMany({
    where: {
      photoId: { in: allPhotoIds },
      rekognitionFaceId: { in: [...matchFaceIds] },
    },
    select: { photoId: true },
  });
  const matchedPhotoIds = [...new Set(detections.map((d) => d.photoId))];

  const photosWithFace = await prisma.faceDetection.findMany({
    where: { photoId: { in: allPhotoIds } },
    select: { photoId: true },
  });
  const photoIdsWithFace = new Set(photosWithFace.map((d) => d.photoId));
  const noFacePhotoIds = allPhotoIds.filter((id) => !photoIdsWithFace.has(id));

  const allowedPhotoIds = [...new Set<number>([...noFacePhotoIds, ...matchedPhotoIds])];
  const photosNoFaceCount = noFacePhotoIds.length;
  const photosMatchedCount = matchedPhotoIds.length;
  const photosVisibleTotal = allowedPhotoIds.length;

  const result: HiddenAlbumAttemptResult =
    photosMatchedCount > 0
      ? HiddenAlbumAttemptResult.MATCH_FOUND
      : HiddenAlbumAttemptResult.NO_MATCH;

  const expiresAt = new Date(Date.now() + GRANT_TTL_MS);
  const durationMs = Date.now() - startTotal;

  // 6) Crear grant y vincular al attempt
  const grant = await prisma.hiddenAlbumGrant.create({
    data: {
      albumId,
      attemptId: attempt.id,
      userId,
      guestId: guestId ?? null,
      expiresAt,
      allowedPhotoIds: allowedPhotoIds as unknown as object,
      allowedCount: allowedPhotoIds.length,
    },
  });

  // 7) Completar attempt
  await prisma.hiddenAlbumAttempt.update({
    where: { id: attempt.id },
    data: {
      result,
      bestMatchConfidence,
      matchedFacesCount: matches.length,
      photosNoFaceCount,
      photosMatchedCount,
      photosVisibleTotal,
      facesInSelfieCount: 1,
      durationMs,
    },
  });

  // 8) Retención de selfie (opcional)
  let selfieObjectKey: string | null = null;
  let selfieExpiresAt: Date | null = null;
  const retentionDays = album.hiddenSelfieRetentionDays ?? 0;
  if (retentionDays > 0) {
    try {
      const key = generateR2Key(`selfie-${attempt.id}.jpg`, "hidden-selfies");
      await uploadToR2(imageBytes, key, "image/jpeg");
      selfieExpiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
      selfieObjectKey = key;
      await prisma.hiddenAlbumAttempt.update({
        where: { id: attempt.id },
        data: {
          selfieStored: true,
          selfieObjectKey: key,
          selfieExpiresAt,
        },
      });
    } catch (r2Err: any) {
      console.error("Error guardando selfie en R2:", r2Err);
      // No fallar la respuesta; el attempt ya está creado
    }
  }

  const token = signGrantToken(grant.id, albumId, expiresAt.getTime());
  const res = NextResponse.json({
    grantId: grant.id,
    expiresAt: expiresAt.toISOString(),
    allowedPhotoIds,
    allowedCount: allowedPhotoIds.length,
  });
  res.headers.set(
    "Set-Cookie",
    `${HIDDEN_ALBUM_GRANT_COOKIE}=${token}; Path=/; Max-Age=${Math.floor(GRANT_TTL_MS / 1000)}; SameSite=Lax; HttpOnly`
  );
  if (!user && guestId) {
    Object.entries(guestIdCookieHeader(guestId)).forEach(([k, v]) => res.headers.append(k, v));
  }
  return res;
}
