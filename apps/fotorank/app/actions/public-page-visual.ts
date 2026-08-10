"use server";

import { prisma } from "@repo/db";
import { requireAuth } from "../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../lib/fotorank/registration";
import {
  parsePublicPageVisualJson,
  validatePublicPageVisualInput,
  type PublicPageVisualConfig,
} from "../lib/fotorank/contest-visual/public-page-visual";
import {
  getContestBannerStorage,
  type ContestBannerExtension,
} from "../lib/fotorank/contest-visual/contest-banner-storage";

export type PublicPageVisualActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Array<{ field: string; message: string }> };

const ALLOWED_MIME = new Map<string, ContestBannerExtension>([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

/** Máximo 4 MB — banners horizontales institucionales. */
const MAX_BANNER_BYTES = 4 * 1024 * 1024;
const MIN_WIDTH = 640;
const MIN_HEIGHT = 240;
const MAX_WIDTH = 6000;
const MAX_HEIGHT = 4000;

const JPEG_SOI = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_RIFF = Buffer.from("RIFF");
const WEBP_WEBP = Buffer.from("WEBP");

function sniffImageMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf.subarray(0, 3).equals(JPEG_SOI)) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIG)) return "image/png";
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).equals(WEBP_RIFF) &&
    buf.subarray(8, 12).equals(WEBP_WEBP)
  ) {
    return "image/webp";
  }
  return null;
}

function readPngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readJpegSize(buf: Buffer): { width: number; height: number } | null {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1]!;
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

function readWebpSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null;
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8X" && buf.length >= 30) {
    const w = 1 + buf[24]! + (buf[25]! << 8) + (buf[26]! << 16);
    const h = 1 + buf[27]! + (buf[28]! << 8) + (buf[29]! << 16);
    return { width: w, height: h };
  }
  if (chunk === "VP8 " && buf.length >= 30) {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

function readImageSize(buf: Buffer, mime: string): { width: number; height: number } | null {
  if (mime === "image/png") return readPngSize(buf);
  if (mime === "image/jpeg") return readJpegSize(buf);
  if (mime === "image/webp") return readWebpSize(buf);
  return null;
}

async function requireContestOrganizer(contestId: string) {
  const user = await requireAuth();
  await assertOrganizerCanAccessContest(contestId, user.id);
  return user;
}

export async function getPublicPageVisualForContest(
  contestId: string,
): Promise<PublicPageVisualActionResult<{ config: PublicPageVisualConfig | null; coverImageUrl: string | null }>> {
  try {
    await requireContestOrganizer(contestId);
  } catch (err) {
    if (err instanceof RegistrationError) return { ok: false, error: err.message };
    throw err;
  }

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { publicPageVisualJson: true, coverImageUrl: true },
  });
  if (!contest) return { ok: false, error: "Concurso no encontrado." };

  return {
    ok: true,
    data: {
      config: parsePublicPageVisualJson(contest.publicPageVisualJson),
      coverImageUrl: contest.coverImageUrl,
    },
  };
}

export async function savePublicPageVisualAction(
  contestId: string,
  input: Partial<PublicPageVisualConfig>,
): Promise<PublicPageVisualActionResult<{ config: PublicPageVisualConfig }>> {
  try {
    await requireContestOrganizer(contestId);
  } catch (err) {
    if (err instanceof RegistrationError) return { ok: false, error: err.message };
    throw err;
  }

  const existing = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { publicPageVisualJson: true, coverImageUrl: true },
  });
  if (!existing) return { ok: false, error: "Concurso no encontrado." };

  const prev = parsePublicPageVisualJson(existing.publicPageVisualJson) ?? { v: 1 as const };
  const mergedInput: Partial<PublicPageVisualConfig> = {
    ...prev,
    ...input,
    v: 1,
  };

  const validated = validatePublicPageVisualInput(mergedInput);
  if (!validated.ok) {
    return {
      ok: false,
      error: validated.errors[0]?.message ?? "Configuración inválida.",
      fieldErrors: validated.errors,
    };
  }

  const next = validated.value;
  // Conservar banner si el form no lo reenvía.
  if (input.bannerUrl === undefined && prev.bannerUrl !== undefined) {
    next.bannerUrl = prev.bannerUrl;
  }
  if (input.bannerCleared === undefined && prev.bannerCleared) {
    next.bannerCleared = true;
  }

  const coverUpdate =
    next.bannerUrl && typeof next.bannerUrl === "string"
      ? { coverImageUrl: next.bannerUrl }
      : next.bannerCleared
        ? { coverImageUrl: null as string | null }
        : {};

  await prisma.fotorankContest.update({
    where: { id: contestId },
    data: {
      publicPageVisualJson: next,
      ...coverUpdate,
    },
  });

  return { ok: true, data: { config: next } };
}

export async function resetPublicPageVisualAction(
  contestId: string,
): Promise<PublicPageVisualActionResult> {
  try {
    await requireContestOrganizer(contestId);
  } catch (err) {
    if (err instanceof RegistrationError) return { ok: false, error: err.message };
    throw err;
  }

  const existing = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { publicPageVisualJson: true },
  });
  if (!existing) return { ok: false, error: "Concurso no encontrado." };

  const prev = parsePublicPageVisualJson(existing.publicPageVisualJson);
  if (prev?.bannerUrl) {
    await getContestBannerStorage().deleteIfManagedPublicUrl(prev.bannerUrl);
  }

  await prisma.fotorankContest.update({
    where: { id: contestId },
    data: { publicPageVisualJson: null },
  });

  return { ok: true, data: undefined };
}

export async function uploadContestPublicBannerAction(
  contestId: string,
  formData: FormData,
): Promise<PublicPageVisualActionResult<{ url: string }>> {
  try {
    await requireContestOrganizer(contestId);
  } catch (err) {
    if (err instanceof RegistrationError) return { ok: false, error: err.message };
    throw err;
  }

  const file = formData.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return { ok: false, error: "No se recibió ningún archivo." };
  }
  const f = file as File;
  const claimedMime = (f.type || "").toLowerCase();
  if (claimedMime && !ALLOWED_MIME.has(claimedMime)) {
    return { ok: false, error: "Formato no permitido. Usá JPEG, PNG o WebP (sin SVG)." };
  }

  const buf = Buffer.from(await f.arrayBuffer());
  if (buf.length > MAX_BANNER_BYTES) {
    return { ok: false, error: "El archivo supera el tamaño máximo (4 MB)." };
  }
  if (buf.length < 64) {
    return { ok: false, error: "Archivo de imagen inválido." };
  }

  const sniffed = sniffImageMime(buf);
  if (!sniffed || !ALLOWED_MIME.has(sniffed)) {
    return { ok: false, error: "El contenido del archivo no es una imagen JPEG/PNG/WebP válida." };
  }
  if (claimedMime && ALLOWED_MIME.get(claimedMime) !== ALLOWED_MIME.get(sniffed)) {
    return { ok: false, error: "El tipo declarado no coincide con el contenido del archivo." };
  }

  const size = readImageSize(buf, sniffed);
  if (!size) {
    return { ok: false, error: "No se pudieron leer las dimensiones de la imagen." };
  }
  if (size.width < MIN_WIDTH || size.height < MIN_HEIGHT) {
    return {
      ok: false,
      error: `La imagen es demasiado pequeña (mínimo ${MIN_WIDTH}×${MIN_HEIGHT} px).`,
    };
  }
  if (size.width > MAX_WIDTH || size.height > MAX_HEIGHT) {
    return {
      ok: false,
      error: `La imagen supera el máximo permitido (${MAX_WIDTH}×${MAX_HEIGHT} px).`,
    };
  }

  const ext = ALLOWED_MIME.get(sniffed)!;
  const existing = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { publicPageVisualJson: true },
  });
  if (!existing) return { ok: false, error: "Concurso no encontrado." };

  const prev = parsePublicPageVisualJson(existing.publicPageVisualJson);
  const storage = getContestBannerStorage();
  const { publicUrl } = await storage.save(contestId, buf, ext);

  if (prev?.bannerUrl) {
    await storage.deleteIfManagedPublicUrl(prev.bannerUrl);
  }

  const nextConfig: PublicPageVisualConfig = {
    ...(prev ?? { v: 1 }),
    v: 1,
    bannerUrl: publicUrl,
    bannerCleared: false,
  };

  await prisma.fotorankContest.update({
    where: { id: contestId },
    data: {
      publicPageVisualJson: nextConfig,
      coverImageUrl: publicUrl,
    },
  });

  return { ok: true, data: { url: publicUrl } };
}

export async function clearContestPublicBannerAction(
  contestId: string,
): Promise<PublicPageVisualActionResult> {
  try {
    await requireContestOrganizer(contestId);
  } catch (err) {
    if (err instanceof RegistrationError) return { ok: false, error: err.message };
    throw err;
  }

  const existing = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { publicPageVisualJson: true, coverImageUrl: true },
  });
  if (!existing) return { ok: false, error: "Concurso no encontrado." };

  const prev = parsePublicPageVisualJson(existing.publicPageVisualJson);
  if (prev?.bannerUrl) {
    await getContestBannerStorage().deleteIfManagedPublicUrl(prev.bannerUrl);
  } else if (existing.coverImageUrl) {
    await getContestBannerStorage().deleteIfManagedPublicUrl(existing.coverImageUrl);
  }

  const next: PublicPageVisualConfig = {
    ...(prev ?? { v: 1 }),
    v: 1,
    bannerUrl: null,
    bannerCleared: true,
  };

  await prisma.fotorankContest.update({
    where: { id: contestId },
    data: {
      publicPageVisualJson: next,
      coverImageUrl: null,
    },
  });

  return { ok: true, data: undefined };
}
