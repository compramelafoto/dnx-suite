/**
 * Inspección sanitizada de eventos webhook recientes (staging/local).
 *
 *   pnpm --filter clickaton communications:webhook:recent -- --limit 20
 */
import { prisma } from "@repo/db";
import { maskProviderId } from "@repo/communications";

function parseLimit(argv: string[]): number {
  const idx = argv.indexOf("--limit");
  if (idx >= 0) {
    const n = Number.parseInt(argv[idx + 1] ?? "20", 10);
    if (Number.isFinite(n)) return Math.min(Math.max(1, n), 50);
  }
  return 20;
}

function maskHash(hash: string | null | undefined): string | null {
  if (!hash) return null;
  if (hash.length <= 10) return `${hash.slice(0, 3)}…`;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

async function main() {
  const limit = parseLimit(process.argv.slice(2));
  const rows = await prisma.dnxCommunicationWebhookEvent.findMany({
    orderBy: { receivedAt: "desc" },
    take: limit,
    select: {
      status: true,
      normalizedEventType: true,
      rawEventType: true,
      receivedAt: true,
      processedAt: true,
      providerEventId: true,
      providerMessageId: true,
      recipientMasked: true,
      recipientHash: true,
      safeLinkHost: true,
      safeLinkPath: true,
      lastErrorCode: true,
      productEffectsEnabled: true,
      processingAttempts: true,
    },
  });

  const behavioralPersisted = rows.filter(
    (r) =>
      r.normalizedEventType === "email.opened" ||
      r.normalizedEventType === "email.clicked",
  );

  console.log(
    JSON.stringify(
      {
        count: rows.length,
        behavioralPersistedCount: behavioralPersisted.length,
        warning:
          behavioralPersisted.length > 0
            ? "UNEXPECTED_BEHAVIORAL_ROWS"
            : null,
        events: rows.map((r) => ({
          status: r.status,
          event: r.normalizedEventType ?? r.rawEventType,
          receivedAt: r.receivedAt.toISOString(),
          processedAt: r.processedAt?.toISOString() ?? null,
          providerEventId: maskProviderId(r.providerEventId) ?? null,
          providerMessageId: maskProviderId(r.providerMessageId ?? undefined) ?? null,
          recipientMasked: r.recipientMasked,
          recipientHash: maskHash(r.recipientHash),
          safeLinkHost: r.safeLinkHost,
          safeLinkPath: r.safeLinkPath,
          lastErrorCode: r.lastErrorCode,
          productEffectsEnabled: r.productEffectsEnabled,
          attempts: r.processingAttempts,
          duplicateLike: r.status === "DUPLICATE",
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message.slice(0, 160) : "query_failed",
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
