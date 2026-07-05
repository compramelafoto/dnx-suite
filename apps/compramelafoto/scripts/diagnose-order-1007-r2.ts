import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { prisma } = await import("../lib/prisma");
  const { fileExistsInR2, urlToR2Key } = await import("../lib/r2-client");
  const { resolveOriginalR2KeyFromStored } = await import("../lib/images/photo-variant-source");

  async function resolveCandidates(originalKey: string | null, previewUrl: string | null) {
    const candidates: string[] = [];
    const fromOrig = originalKey ? resolveOriginalR2KeyFromStored(originalKey) : null;
    if (fromOrig) candidates.push(fromOrig);
    if (previewUrl) {
      const previewKey = urlToR2Key(previewUrl);
      candidates.push(previewKey.replace("preview_", "original_"));
      candidates.push(previewKey);
    }
    return [...new Set(candidates.filter(Boolean))];
  }

  const orderId = 1007;
  const items = await prisma.orderItem.findMany({
    where: { orderId, productType: "DIGITAL" },
    include: {
      photo: { select: { id: true, originalKey: true, previewUrl: true } },
    },
  });

  let deliverableOriginal = 0;
  let deliverablePreviewOnly = 0;
  let none = 0;

  for (const it of items) {
    const p = it.photo!;
    const candidates = await resolveCandidates(p.originalKey, p.previewUrl);
    let found: { key: string; kind: string } | null = null;
    for (const key of candidates) {
      if (await fileExistsInR2(key)) {
        found = {
          key,
          kind: key.includes("original_") ? "original" : "preview",
        };
        break;
      }
    }
    if (!found) {
      none++;
      console.log("NO FILE", p.id);
    } else if (found.kind === "original") {
      deliverableOriginal++;
    } else {
      deliverablePreviewOnly++;
      console.log("PREVIEW ONLY", p.id, found.key.slice(-60));
    }
  }

  console.log({
    total: items.length,
    deliverableOriginal,
    deliverablePreviewOnly,
    none,
  });

  await prisma.$disconnect();
}

main().catch(console.error);
