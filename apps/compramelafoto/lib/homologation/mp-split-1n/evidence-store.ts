import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export const CLF_CARD_BRICK_HOMOLOGATION_SOURCE =
  "CLF_CARD_BRICK_HOMOLOGATION" as const;

export type ClfBrickHomologationEvidence = {
  source: typeof CLF_CARD_BRICK_HOMOLOGATION_SOURCE;
  scenarioId: string;
  partnerCount: number;
  totalMinor: string;
  currency: "ARS";
  providerOrderId: string;
  providerOrderIdPrefix: string;
  status: string;
  statusDetail: string | null;
  paymentTransactionIdPrefix: string | null;
  DEVICE_SESSION_PRESENT: boolean;
  deviceSessionIdLength: number;
  amountType: "fixed";
  splitSumValid: boolean;
  createdAt: string;
  environment: "sandbox";
  productionWrites: "BLOCKED";
};

function auditDir(): string {
  // apps/compramelafoto → monorepo root .local/
  return resolve(process.cwd(), "../../.local/audit-clf-brick");
}

export function writeClfBrickHomologationEvidence(
  evidence: ClfBrickHomologationEvidence,
): string {
  const dir = auditDir();
  mkdirSync(dir, { recursive: true });
  const last = resolve(dir, "last.json");
  const stamped = resolve(
    dir,
    `smoke-${evidence.scenarioId}-${Date.now()}.json`,
  );
  const body = JSON.stringify(evidence, null, 2);
  writeFileSync(last, body);
  writeFileSync(stamped, body);
  return last;
}

export function readLastClfBrickHomologationEvidence(): ClfBrickHomologationEvidence | null {
  const last = resolve(auditDir(), "last.json");
  if (!existsSync(last)) return null;
  try {
    return JSON.parse(readFileSync(last, "utf8")) as ClfBrickHomologationEvidence;
  } catch {
    return null;
  }
}

export function prefixId(value: string | null | undefined, n = 12): string | null {
  if (!value) return null;
  return value.length <= n ? `${value.slice(0, 2)}…` : `${value.slice(0, n)}…`;
}
