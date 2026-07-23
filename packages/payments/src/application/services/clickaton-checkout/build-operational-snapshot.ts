/**
 * Build an append-only operational snapshot for a registration checkout amount.
 * Never mutates the historical 10D3I-E simulation snapshot.
 */
import { createFinancialDomainStore } from "../../../financial-identity/memory-store.js";
import { EconomicAgreementService } from "../../../economic-agreement/service.js";
import {
  hydrateAgreementGraphFromPrisma,
  persistEconomicAgreementGraphDelta,
  type EconomicAgreementPrisma,
} from "../../../infrastructure/prisma/economic-agreement-remote.js";

export const CLICKATON_STAGING_AGREEMENT_SCOPE = {
  productKey: "clickaton",
  scopeType: "STAGING_TEST",
  scopeId: "partners-10d3i-e",
} as const;

export type OperationalSnapshotResult = {
  snapshotId: string;
  snapshotIdPrefix: string;
  hashPrefix: string;
  totalMinor: string;
  bps: number[];
  agreementIdPrefix: string;
  versionNumber: number;
  externalReference: string;
  compatibleJson: Record<string, unknown>;
};

export async function buildClickatonOperationalSnapshot(input: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any;
  totalMinor: bigint;
  externalReference: string;
  paymentIntentId?: string | null;
  paymentOrderId?: string | null;
}): Promise<OperationalSnapshotResult> {
  const store = createFinancialDomainStore();
  await hydrateAgreementGraphFromPrisma(
    input.prisma as EconomicAgreementPrisma,
    store,
  );
  const priorSnapshotIds = new Set(store.snapshots.keys());

  const agreements = new EconomicAgreementService(store);
  const agreement = agreements.resolveAgreementForOrder(CLICKATON_STAGING_AGREEMENT_SCOPE);
  if (!agreement || agreement.status !== "ACTIVE") {
    throw new Error("CLICKATON_STAGING_AGREEMENT_MISSING");
  }

  const { snapshot, compatibleJson } = agreements.buildAndPersistOrderSnapshot({
    agreementId: agreement.id,
    totalMinor: input.totalMinor,
    externalReference: input.externalReference,
    paymentIntentId: input.paymentIntentId ?? null,
    paymentOrderId: input.paymentOrderId ?? null,
  });

  if (priorSnapshotIds.has(snapshot.id)) {
    throw new Error("SNAPSHOT_ID_COLLISION");
  }

  await persistEconomicAgreementGraphDelta(
    input.prisma as EconomicAgreementPrisma,
    store,
    {
      agreementIds: new Set(store.agreements.keys()),
      participantIds: new Set(store.participants.keys()),
      versionIds: new Set(store.versions.keys()),
      ruleIds: new Set(store.rules.keys()),
      snapshotIds: priorSnapshotIds,
    },
  );

  const bps = snapshot.payload.participants
    .map((p) => p.shareBps ?? 0)
    .sort((a, b) => a - b);

  return {
    snapshotId: snapshot.id,
    snapshotIdPrefix: snapshot.id.slice(0, 10),
    hashPrefix: snapshot.engineInputHash.slice(0, 12),
    totalMinor: snapshot.totalMinor.toString(),
    bps,
    agreementIdPrefix: snapshot.agreementId.slice(0, 10),
    versionNumber: snapshot.versionNumber,
    externalReference: snapshot.externalReference ?? input.externalReference,
    compatibleJson,
  };
}
