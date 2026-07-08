import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EventOrganizerCommissionPayoutMode,
  EventOrganizerCommissionStatus,
} from "@prisma/client";
import {
  countsTowardOrganizerWithdrawalBalance,
  isOrganizerDirectMpCollectionCommission,
  isPlatformHeldOrganizerCommission,
  isPlatformWithdrawalPaidCommission,
  organizerDirectMpCollectionCommissionFields,
  resolveOrganizerCommissionCollectionType,
} from "@/lib/event-organizer-commission-ledger";

describe("CLF-ORGANIZER-AS-COLLECTOR-100 — ledger", () => {
  it("evento 100% organizer collector es cobro directo MP", () => {
    const fields = organizerDirectMpCollectionCommissionFields(new Date("2026-07-01T12:00:00Z"));
    assert.equal(fields.status, EventOrganizerCommissionStatus.PAID_DIRECT_TO_ORGANIZER);
    assert.equal(fields.payoutMode, EventOrganizerCommissionPayoutMode.ORGANIZER_AS_COLLECTOR);
    assert.equal(
      isOrganizerDirectMpCollectionCommission({
        status: fields.status,
        payoutMode: fields.payoutMode,
      }),
      true
    );
    assert.equal(resolveOrganizerCommissionCollectionType(fields), "DIRECT_MP");
  });

  it("evento 100% direct MP no genera saldo de retiro", () => {
    const row = organizerDirectMpCollectionCommissionFields(new Date());
    assert.equal(countsTowardOrganizerWithdrawalBalance(row), false);
  });

  it("evento 100% direct MP no es HELD_BY_PLATFORM", () => {
    const row = organizerDirectMpCollectionCommissionFields(new Date());
    assert.equal(isPlatformHeldOrganizerCommission(row), false);
  });

  it("evento 90% mantiene comisión pendiente de retiro", () => {
    const row = {
      status: EventOrganizerCommissionStatus.PENDING,
      payoutMode: EventOrganizerCommissionPayoutMode.HELD_BY_PLATFORM,
    };
    assert.equal(isOrganizerDirectMpCollectionCommission(row), false);
    assert.equal(isPlatformHeldOrganizerCommission(row), true);
    assert.equal(countsTowardOrganizerWithdrawalBalance(row), true);
    assert.equal(resolveOrganizerCommissionCollectionType(row), "PLATFORM_HELD");
  });

  it("reportes distinguen retenida vs cobro directo", () => {
    const held = {
      status: EventOrganizerCommissionStatus.AVAILABLE,
      payoutMode: EventOrganizerCommissionPayoutMode.HELD_BY_PLATFORM,
    };
    const direct = organizerDirectMpCollectionCommissionFields(new Date());
    const paidWithdrawal = {
      status: EventOrganizerCommissionStatus.PAID,
      payoutMode: EventOrganizerCommissionPayoutMode.HELD_BY_PLATFORM,
    };
    assert.equal(resolveOrganizerCommissionCollectionType(held), "PLATFORM_HELD");
    assert.equal(resolveOrganizerCommissionCollectionType(direct), "DIRECT_MP");
    assert.equal(isPlatformWithdrawalPaidCommission(paidWithdrawal), true);
    assert.equal(isPlatformWithdrawalPaidCommission(direct), false);
  });
});
