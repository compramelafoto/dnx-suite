import type { CalculatedDistribution } from "../../../distribution/types.js";
import { money } from "../../../money/index.js";
import type { PartnerConsentEvidence } from "./consent-evidence.js";
import { testActivePartnerConsent } from "./consent-evidence.js";
import { singleIntangibleItem, type OrderItemInput } from "./order-items.js";
import {
  FAKE_PARTNER_RECEIVER_ID,
  FAKE_PARTNER_RECEIVER_ID_2,
} from "../testing/fixtures.js";

/** Explicit TEST device session — only with allowTestFixtures. */
export const TEST_DEVICE_SESSION_ID = "dnx-test-device-session-homolog-01";

export function testPartnerConsents(
  pairs: Array<[recipientId: string, receiverId: string]>,
): Map<string, PartnerConsentEvidence> {
  return new Map(
    pairs.map(([recipientId, receiverId]) => [
      recipientId,
      testActivePartnerConsent(receiverId),
    ]),
  );
}

export function defaultTestSplitExtras(opts: {
  totalMinor?: bigint;
  title?: string;
  partners?: Array<[string, string]>;
}): {
  payerEmail: string;
  statementDescriptor: string;
  items: OrderItemInput[];
  deviceSessionId: string;
  partnerReceiverIds: Map<string, string>;
  partnerConsentsByRecipientId: Map<string, PartnerConsentEvidence>;
} {
  const total = money("ARS", opts.totalMinor ?? 100_000n);
  const partners = opts.partners ?? [["photographer", FAKE_PARTNER_RECEIVER_ID]];
  return {
    payerEmail: "test_buyer@testuser.com",
    statementDescriptor: "DNX",
    items: [
      singleIntangibleItem({
        title: opts.title ?? "Servicio intangible de prueba",
        total,
        categoryId: "others",
      }),
    ],
    deviceSessionId: TEST_DEVICE_SESSION_ID,
    partnerReceiverIds: new Map(partners),
    partnerConsentsByRecipientId: testPartnerConsents(partners),
  };
}

export function twoPartnerTestExtras(distribution: CalculatedDistribution) {
  void distribution;
  return defaultTestSplitExtras({
    partners: [
      ["photographer", FAKE_PARTNER_RECEIVER_ID],
      ["organizer", FAKE_PARTNER_RECEIVER_ID_2],
    ],
  });
}
