import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Garantiza que el evento tenga shareSlug (para links /e y /g).
 */
export async function ensureEventShareSlug(eventId: number): Promise<string> {
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: { shareSlug: true },
  });
  if (existing?.shareSlug) return existing.shareSlug;

  let slug: string;
  let attempts = 0;
  do {
    slug = `e-${crypto.randomBytes(8).toString("base64url").replace(/[_-]/g, "").slice(0, 12)}`;
    attempts++;
    if (attempts > 5) {
      slug = `e-${eventId}-${crypto.randomBytes(4).toString("hex")}`;
      break;
    }
  } while (await prisma.event.findUnique({ where: { shareSlug: slug } }));

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { shareSlug: slug },
    select: { shareSlug: true },
  });
  return updated.shareSlug!;
}
