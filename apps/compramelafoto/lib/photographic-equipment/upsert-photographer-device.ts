import type { PhotographerDevice } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  buildNormalizedKey,
  inferConfidence,
  inferDeviceType,
} from "@/lib/photographic-equipment/device-inference";

export type UpsertPhotographerDeviceInput = {
  photographerId: number;
  brand: string;
  model: string;
  serialNumber?: string | null;
  lensBrand?: string | null;
  lensModel?: string | null;
  seenAt: Date;
};

export async function upsertPhotographerDevice(
  input: UpsertPhotographerDeviceInput
): Promise<PhotographerDevice> {
  const brand = input.brand.trim() || "Desconocido";
  const model = input.model.trim() || "Desconocido";
  const serialNumber = input.serialNumber?.trim() || null;
  const normalizedKey = buildNormalizedKey(
    input.photographerId,
    brand,
    model,
    serialNumber
  );
  const deviceType = inferDeviceType(brand, model);
  const confidence = inferConfidence(brand, model, serialNumber);

  const existing = await prisma.photographerDevice.findUnique({
    where: {
      photographerId_normalizedKey: {
        photographerId: input.photographerId,
        normalizedKey,
      },
    },
    select: { id: true, lensBrand: true, lensModel: true },
  });

  if (existing) {
    return prisma.photographerDevice.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: input.seenAt,
        photoCount: { increment: 1 },
        deviceType,
        confidence,
        lensBrand: existing.lensBrand ?? input.lensBrand?.trim() ?? null,
        lensModel: existing.lensModel ?? input.lensModel?.trim() ?? null,
      },
    });
  }

  return prisma.photographerDevice.create({
    data: {
      photographerId: input.photographerId,
      brand,
      model,
      serialNumber,
      normalizedKey,
      deviceType,
      lensBrand: input.lensBrand?.trim() || null,
      lensModel: input.lensModel?.trim() || null,
      firstSeenAt: input.seenAt,
      lastSeenAt: input.seenAt,
      photoCount: 1,
      confidence,
    },
  });
}
