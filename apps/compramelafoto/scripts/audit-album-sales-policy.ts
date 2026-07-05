/**
 * Herramienta de análisis Fase 1 — política de ventas unificada vs legacy.
 *
 * Uso:
 *   npx tsx scripts/audit-album-sales-policy.ts <albumId>
 *   npx tsx scripts/audit-album-sales-policy.ts --divergent-only --limit 50
 */

import { prisma } from "@/lib/prisma";
import { buildSalesPolicyReadinessSummary } from "@/lib/sales/album-sales-policy-readiness";
import { resolveAlbumSalesPolicy } from "@/lib/sales/resolve-album-sales-policy";

function parseArgs(argv: string[]) {
  const divergentOnly = argv.includes("--divergent-only");
  const limitIdx = argv.indexOf("--limit");
  const limit =
    limitIdx >= 0 && argv[limitIdx + 1]
      ? Math.max(1, parseInt(argv[limitIdx + 1], 10) || 50)
      : 25;
  const albumIdArg = argv.find((a) => /^\d+$/.test(a));
  const albumId = albumIdArg ? parseInt(albumIdArg, 10) : null;
  return { divergentOnly, limit, albumId };
}

async function auditOne(albumId: number) {
  const policy = await resolveAlbumSalesPolicy(albumId);
  if (!policy) {
    console.log(`Álbum #${albumId}: no encontrado`);
    return null;
  }
  const summary = buildSalesPolicyReadinessSummary(policy);
  return { policy, summary };
}

async function main() {
  const { divergentOnly, limit, albumId } = parseArgs(process.argv.slice(2));

  if (albumId != null) {
    const result = await auditOne(albumId);
    if (!result) return;
    const { policy, summary } = result;
    console.log(JSON.stringify({ policy, summary }, null, 2));
    return;
  }

  const albums = await prisma.album.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true },
    orderBy: { id: "desc" },
    take: limit * 4,
  });

  let shown = 0;
  for (const row of albums) {
    if (shown >= limit) break;
    const result = await auditOne(row.id);
    if (!result) continue;
    const { policy, summary } = result;
    if (divergentOnly && !policy.divergence.hasAny) continue;

    console.log("—".repeat(60));
    console.log(`#${row.id} ${row.title}`);
    console.log(
      `legacy complete=${policy.completeness.legacyIsComplete} · caps=[${policy.capabilities.effective.join(", ")}]`
    );
    console.log(
      `digital legacy=${summary.legacyDigitalActive} cap=${summary.capabilityDigitalActive} price=${summary.effectiveDigitalPriceArs}`
    );
    console.log(
      `print legacy=${summary.legacyPrintActive} cap=${summary.capabilityPrintActive} lab=${summary.effectiveLabId}`
    );
    if (policy.divergence.hasAny) {
      console.log(`DIVERGENCIA: ${policy.divergence.summaryLines.join(" | ")}`);
    }
    shown += 1;
  }

  console.log("—".repeat(60));
  console.log(`Mostrados: ${shown} álbum(es)${divergentOnly ? " con divergencia" : ""}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
