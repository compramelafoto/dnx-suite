import { prisma } from "@/lib/admin/db";
import { getWelcomeCardStorage } from "./storage";

/** Lee bytes de R2/local o de metadata.inlineBase64 (Staging serverless sin R2). */
export async function resolveMediaBody(storageKey: string): Promise<Buffer> {
  const asset = await prisma.dnxMediaAsset.findFirst({
    where: { storageKey },
    select: { metadata: true },
  });
  const meta = asset?.metadata as { inlineBase64?: string } | null;
  if (typeof meta?.inlineBase64 === "string" && meta.inlineBase64.length > 0) {
    return Buffer.from(meta.inlineBase64, "base64");
  }
  return getWelcomeCardStorage().get(storageKey);
}
