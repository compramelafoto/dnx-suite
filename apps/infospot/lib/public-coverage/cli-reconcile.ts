/**
 * CLI manual: reconciliar estado comercial editorial + invalidar cache público.
 * Uso: pnpm --filter infospot reconcile:public-coverage
 */

import { reconcilePublicCoverageCommercial } from "./invalidate";

async function main() {
  const result = await reconcilePublicCoverageCommercial({ take: 100 });
  if (!result.ok) {
    console.error("reconcile failed:", result.error);
    process.exitCode = 1;
    return;
  }
  console.log(`ok — photos updated: ${result.photosUpdated}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
