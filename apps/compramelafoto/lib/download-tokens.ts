/**
 * Sistema de tokens seguros para descargas
 */

import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export type DownloadTokenType = "CLIENT_DIGITAL" | "LAB_PRINT";

/**
 * Crea un token de descarga para cliente (foto digital)
 */
export async function createClientDownloadToken(params: {
  orderId: number;
  photoId?: number; // Si es null, es descarga completa del pedido
  albumId: number;
  expiresAt: Date;
  maxDownloads?: number; // null = ilimitado
}): Promise<string> {
  const { orderId, photoId, albumId, expiresAt, maxDownloads } = params;

  const token = randomBytes(32).toString("hex");

  await prisma.orderDownloadToken.create({
    data: {
      token,
      type: "CLIENT_DIGITAL",
      orderId,
      photoId: photoId || null,
      albumId,
      expiresAt,
      maxDownloads: maxDownloads || null,
    },
  });

  return token;
}

/**
 * Crea un token de descarga para laboratorio (archivo para impresión)
 */
export async function createLabDownloadToken(params: {
  orderId: number;
  photoId?: number; // Si es null, es descarga completa del pedido
  expiresAt: Date;
  maxDownloads?: number;
}): Promise<string> {
  const { orderId, photoId, expiresAt, maxDownloads } = params;

  const token = randomBytes(32).toString("hex");

  await prisma.orderDownloadToken.create({
    data: {
      token,
      type: "LAB_PRINT",
      orderId,
      photoId: photoId || null,
      expiresAt,
      maxDownloads: maxDownloads || null,
    },
  });

  return token;
}

/**
 * Valida y consume un token de descarga
 */
export async function validateDownloadToken(
  token: string
): Promise<{
  valid: boolean;
  token?: {
    id: number;
    type: DownloadTokenType;
    orderId: number | null;
    photoId: number | null;
    albumId: number | null;
    expiresAt: Date;
    downloadCount: number;
    maxDownloads: number | null;
  };
  error?: string;
}> {
  const downloadToken = await prisma.orderDownloadToken.findUnique({
    where: { token },
  });

  if (!downloadToken) {
    return { valid: false, error: "Token no válido" };
  }

  // Verificar expiración
  if (downloadToken.expiresAt < new Date()) {
    return { valid: false, error: "Token expirado" };
  }

  // Verificar límite de descargas
  if (
    downloadToken.maxDownloads !== null &&
    downloadToken.downloadCount >= downloadToken.maxDownloads
  ) {
    return { valid: false, error: "Límite de descargas alcanzado" };
  }

  // Incrementar contador y actualizar última vez usado
  await prisma.orderDownloadToken.update({
    where: { id: downloadToken.id },
    data: {
      downloadCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  return {
    valid: true,
    token: {
      id: downloadToken.id,
      type: downloadToken.type,
      orderId: downloadToken.orderId,
      photoId: downloadToken.photoId,
      albumId: downloadToken.albumId,
      expiresAt: downloadToken.expiresAt,
      downloadCount: downloadToken.downloadCount + 1,
      maxDownloads: downloadToken.maxDownloads,
    },
  };
}

/**
 * Obtiene todos los tokens válidos para un pedido
 */
export async function getOrderDownloadTokens(orderId: number) {
  return prisma.orderDownloadToken.findMany({
    where: {
      orderId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Revoca (elimina) todos los tokens de descarga de un pedido
 */
export async function revokeOrderDownloadTokens(orderId: number) {
  if (!Number.isFinite(orderId)) return { count: 0 };
  return prisma.orderDownloadToken.deleteMany({
    where: { orderId },
  });
}
