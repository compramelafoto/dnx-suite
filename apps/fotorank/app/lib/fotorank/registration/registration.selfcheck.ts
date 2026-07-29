/**
 * Self-check dominio inscripción P0-01 (sin DB).
 * pnpm --filter fotorank exec tsx app/lib/fotorank/registration/registration.selfcheck.ts
 */
import assert from "node:assert/strict";
import { resolveFinancePolicy } from "./finance";
import { buildRegistrationNumber } from "./registration-number";
import {
  RULES_PLACEHOLDER_MARKER,
  contentContainsPlaceholder,
  hashRulesContent,
} from "./rules-hash";
import {
  buildEntryStorageKey,
  canAccessEntryAsset,
  createMemoryContestEntryStorage,
} from "../storage/contest-entry-storage";
import { assertRegistrationWindowOpen } from "./windows";
import { RegistrationError } from "./errors";

// 1 FREE finance
{
  const f = resolveFinancePolicy({
    paymentMode: "FREE",
    registrationPriceAmountMinor: 999,
    currency: "ARS",
    contestPlatformFeeBps: 1500,
    organizationPlatformFeeBps: 2000,
  });
  assert.equal(f.paymentMode, "FREE");
  assert.equal(f.registrationPriceMinor, 0);
  assert.equal(f.platformFeeBps, 0);
  assert.equal(f.organizerNetBps, 10_000);
  assert.equal(f.feeSource, "NONE");
  assert.equal(f.policySnapshot.platformFeeBps, 0);
}

// 2 PAID snapshot fee override
{
  const f = resolveFinancePolicy({
    paymentMode: "PAID",
    registrationPriceAmountMinor: 500_000,
    currency: "ars",
    contestPlatformFeeBps: 1500,
    organizationPlatformFeeBps: 2000,
  });
  assert.equal(f.platformFeeBps, 1500);
  assert.equal(f.feeSource, "CONTEST_OVERRIDE");
  assert.equal(f.organizerNetBps, 8500);
  assert.equal(f.currency, "ARS");
}

// 3 fee change after resolve does not mutate prior snapshot
{
  const first = resolveFinancePolicy({
    paymentMode: "PAID",
    registrationPriceAmountMinor: 1000,
    currency: "ARS",
    contestPlatformFeeBps: 1000,
    organizationPlatformFeeBps: null,
  });
  const second = resolveFinancePolicy({
    paymentMode: "PAID",
    registrationPriceAmountMinor: 1000,
    currency: "ARS",
    contestPlatformFeeBps: 2500,
    organizationPlatformFeeBps: null,
  });
  assert.equal(first.platformFeeBps, 1000);
  assert.equal(second.platformFeeBps, 2500);
  assert.notEqual(first.policySnapshot.platformFeeBps, second.policySnapshot.platformFeeBps);
}

// 4 invalid bps
assert.throws(
  () =>
    resolveFinancePolicy({
      paymentMode: "PAID",
      registrationPriceAmountMinor: 100,
      currency: "ARS",
      contestPlatformFeeBps: 10001,
      organizationPlatformFeeBps: null,
    }),
  (e) => e instanceof RegistrationError && e.code === "INVALID_FEE_BPS",
);

// 5 closed window
assert.throws(
  () =>
    assertRegistrationWindowOpen(
      {
        status: "PUBLISHED",
        registrationEnabled: true,
        registrationOpensAt: new Date("2026-01-01T00:00:00Z"),
        registrationClosesAt: new Date("2026-01-02T00:00:00Z"),
        startAt: null,
        submissionDeadline: null,
        registrationCapacity: null,
      },
      0,
      new Date("2026-06-01T00:00:00Z"),
    ),
  (e) => e instanceof RegistrationError && e.code === "REGISTRATION_WINDOW_CLOSED",
);

// 6 open window
assert.doesNotThrow(() =>
  assertRegistrationWindowOpen(
    {
      status: "PUBLISHED",
      registrationEnabled: true,
      registrationOpensAt: new Date("2026-08-01T00:00:00Z"),
      registrationClosesAt: new Date("2026-09-30T00:00:00Z"),
      startAt: null,
      submissionDeadline: null,
      registrationCapacity: 100,
    },
    10,
    new Date("2026-08-15T00:00:00Z"),
  ),
);

// 7 hash stable
{
  const a = hashRulesContent("hola\r\n");
  const b = hashRulesContent("hola\n");
  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.ok(contentContainsPlaceholder(`${RULES_PLACEHOLDER_MARKER}\nresto`));
}

// 8 registration number
assert.equal(buildRegistrationNumber("santa-fe-en-foco", 1), "SANTAF-000001");

// 9 storage key + private access
{
  const key = buildEntryStorageKey({
    contestId: "c1",
    registrationId: "r1",
    entryId: "e1",
    kind: "ORIGINAL",
  });
  assert.equal(key, "fotorank/contests/c1/registrations/r1/entries/e1/original");
  assert.ok(!key.startsWith("http"));

  const storage = createMemoryContestEntryStorage();
  assert.equal(storage.isPrivate, true);

  const ctx = {
    contestId: "c1",
    registrationId: "r1",
    registrationParticipantUserId: 7,
    contestOrganizationId: "org1",
    kind: "ORIGINAL" as const,
  };
  assert.equal(
    canAccessEntryAsset({ role: "participant", userId: 7, registrationId: "r1", contestId: "c1" }, ctx),
    true,
  );
  assert.equal(
    canAccessEntryAsset({ role: "participant", userId: 8, registrationId: "r1", contestId: "c1" }, ctx),
    false,
  );
  assert.equal(
    canAccessEntryAsset({ role: "organizer", userId: 1, organizationId: "org-other", contestId: "c1" }, ctx),
    false,
  );
  assert.equal(
    canAccessEntryAsset({ role: "organizer", userId: 1, organizationId: "org1", contestId: "c1" }, ctx),
    true,
  );
}

// 10 FREE zero price confirmed path marker (finance only)
{
  const f = resolveFinancePolicy({
    paymentMode: "FREE",
    registrationPriceAmountMinor: 0,
    currency: "ARS",
    contestPlatformFeeBps: null,
    organizationPlatformFeeBps: null,
  });
  assert.equal(f.registrationPriceMinor, 0);
}

console.log("registration.selfcheck.ts OK");
