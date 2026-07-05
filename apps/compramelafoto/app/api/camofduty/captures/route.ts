import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateR2Key, uploadToR2 } from "@/lib/r2-client";
import {
  SIMULATOR_CAPTURE_RETENTION_DAYS,
  type SimulatorCaptureMetadata,
} from "@/lib/simulator/capture-metadata";
import { dataUrlToBuffer } from "@/lib/simulator/capture-export";
import type { PhotoStarRating } from "@/lib/simulator/camera-exposure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function retentionDate(from = new Date()): Date {
  return new Date(from.getTime() + SIMULATOR_CAPTURE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

function parseStars(value: unknown): PhotoStarRating {
  const stars = Math.round(Number(value));
  if (!Number.isFinite(stars) || stars < 0 || stars > 5) return 0;
  return stars as PhotoStarRating;
}

function serializeCapture(record: {
  id: string;
  imageUrl: string;
  capturedAt: Date;
  expiresAt: Date;
  stars: number;
  takenByName: string | null;
  takenByEmail: string;
  metadata: unknown;
}) {
  return {
    id: record.id,
    imageUrl: record.imageUrl,
    capturedAt: record.capturedAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    stars: parseStars(record.stars),
    takenByName: record.takenByName,
    takenByEmail: record.takenByEmail,
    metadata: record.metadata as SimulatorCaptureMetadata,
  };
}

/** GET /api/camofduty/captures — fotos del usuario no vencidas (7 días). */
export async function GET() {
  const { error, user } = await requireAuth();
  if (error || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const now = new Date();
  const captures = await prisma.simulatorCapture.findMany({
    where: {
      userId: user.id,
      expiresAt: { gt: now },
    },
    orderBy: { capturedAt: "asc" },
  });

  return NextResponse.json({
    captures: captures.map(serializeCapture),
    retentionDays: SIMULATOR_CAPTURE_RETENTION_DAYS,
  });
}

/** POST /api/camofduty/captures — guarda JPG + metadatos en R2/DB. */
export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: {
    imageDataUrl?: string;
    metadata?: SimulatorCaptureMetadata;
    stars?: number;
    capturedAt?: number;
    localClientId?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const imageDataUrl = body.imageDataUrl?.trim();
  const metadata = body.metadata;
  if (!imageDataUrl?.startsWith("data:image/jpeg")) {
    return NextResponse.json({ error: "Imagen JPEG requerida" }, { status: 400 });
  }
  if (!metadata?.settings) {
    return NextResponse.json({ error: "Metadatos de captura requeridos" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = dataUrlToBuffer(imageDataUrl);
  } catch {
    return NextResponse.json({ error: "Imagen inválida" }, { status: 400 });
  }

  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "La imagen supera el tamaño máximo permitido" }, { status: 413 });
  }

  const capturedAt = body.capturedAt ? new Date(body.capturedAt) : new Date();
  if (Number.isNaN(capturedAt.getTime())) {
    return NextResponse.json({ error: "Fecha de captura inválida" }, { status: 400 });
  }

  const enrichedMetadata: SimulatorCaptureMetadata = {
    ...metadata,
    localClientId: body.localClientId ?? metadata.localClientId,
  };

  const key = generateR2Key(`capture-${capturedAt.getTime()}.jpg`, `camofduty/captures/${user.id}`);

  try {
    const { url } = await uploadToR2(buffer, key, "image/jpeg", {
      source: "cam-of-duty-simulator",
      userId: String(user.id),
    });

    const record = await prisma.simulatorCapture.create({
      data: {
        userId: user.id,
        storageKey: key,
        imageUrl: url,
        capturedAt,
        expiresAt: retentionDate(capturedAt),
        stars: parseStars(body.stars),
        takenByName: user.name,
        takenByEmail: user.email,
        metadata: enrichedMetadata as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      capture: serializeCapture(record),
    });
  } catch (uploadError) {
    console.error("[camofduty/captures] upload error:", uploadError);
    return NextResponse.json(
      { error: "No se pudo almacenar la foto. Intentá de nuevo." },
      { status: 500 },
    );
  }
}
