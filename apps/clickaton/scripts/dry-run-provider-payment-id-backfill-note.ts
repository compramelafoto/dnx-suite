#!/usr/bin/env tsx
/**
 * Nota READ-ONLY: candidato histórico Paula (Imp-05) para backfill opcional de providerPaymentId.
 *
 * NO escribe. NO aplica. Solo documenta el candidato.
 *
 *   pnpm --filter clickaton exec tsx scripts/dry-run-provider-payment-id-backfill-note.ts
 */
console.log(
  JSON.stringify(
    {
      ok: true,
      wrote: false,
      applied: false,
      createdRefund: false,
      optionalBackfillCandidate: {
        providerPaymentId: "171556178494",
        registrationId: "cmsaj4fai0001l40444c74fgw",
        localProviderPaymentId: null,
        note:
          "Tras Imp-06, nuevos APPROVED persisten providerPaymentId. Este caso histórico puede backfillearse aparte si se desea; no es requerido para integridad operativa actual.",
      },
    },
    null,
    2,
  ),
);
