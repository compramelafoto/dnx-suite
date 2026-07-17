/**
 * Self-check inscripción pública (Etapa 09A operativa).
 * pnpm exec tsx apps/fotorank/app/lib/public-api/v1/registration.selfcheck.ts
 */
import assert from "node:assert/strict";
import {
  buildRegistrationHandoffUrl,
  formatMoneyMinor,
  isSafeClickatonReturnTo,
  resolvePublicRegistrationState,
  serializePublicRegistrationV1,
} from "./registration";

const base = {
  slug: "clickaton-demo",
  eventStatus: "published" as const,
  registrationEnabled: true,
  pricingMode: "FREE" as const,
  priceAmountMinor: null as number | null,
  currency: null as string | null,
  opensAt: new Date("2026-01-01T00:00:00.000Z"),
  closesAt: new Date("2026-12-31T00:00:00.000Z"),
  submissionDeadline: new Date("2026-12-31T00:00:00.000Z"),
  eventStartAt: new Date("2026-01-01T00:00:00.000Z"),
  capacity: null as number | null,
  confirmedCount: null as number | null,
  hasOptionalMerchandise: false,
};

const now = new Date("2026-06-01T00:00:00.000Z");

// 1 free open
{
  const reg = serializePublicRegistrationV1(base, {
    now,
    webBaseUrl: "http://localhost:3000",
    clickatonOrigin: "http://localhost:3005",
    includeReturnTo: true,
    source: "clickaton",
  });
  assert.equal(reg.mode, "free");
  assert.equal(reg.status, "open");
  assert.equal(reg.canRegister, true);
  assert.equal(reg.displayPrice, null);
  assert.ok(reg.registrationUrl?.includes("/concursos/clickaton-demo"));
  assert.ok(reg.registrationUrl?.includes("source=clickaton"));
  assert.equal(reg.checkoutUrl, null);
}

// 2 paid open
{
  const reg = serializePublicRegistrationV1(
    {
      ...base,
      pricingMode: "PAID",
      priceAmountMinor: 2_000_000,
      currency: "ARS",
    },
    { now, webBaseUrl: "http://localhost:3000" },
  );
  assert.equal(reg.mode, "paid");
  assert.equal(reg.displayPrice?.amountMinor, 2_000_000);
  assert.equal(reg.displayPrice?.currency, "ARS");
  assert.ok(reg.displayPrice?.formatted);
  assert.equal(reg.canRegister, true);
}

// 3 money minor
assert.ok(formatMoneyMinor(2000000, "ARS").includes("20"));

// 5-6 merch free/paid
{
  const freeMerch = serializePublicRegistrationV1(
    { ...base, hasOptionalMerchandise: true },
    { now, webBaseUrl: "http://localhost:3000" },
  );
  assert.equal(freeMerch.hasOptionalMerchandise, true);
  const paidMerch = serializePublicRegistrationV1(
    {
      ...base,
      pricingMode: "PAID",
      priceAmountMinor: 100,
      currency: "ARS",
      hasOptionalMerchandise: true,
    },
    { now, webBaseUrl: "http://localhost:3000" },
  );
  assert.equal(paidMerch.hasOptionalMerchandise, true);
}

// 8 canRegister without URL
{
  const reg = serializePublicRegistrationV1(base, { now, webBaseUrl: null });
  assert.equal(reg.canRegister, false);
  assert.equal(reg.registrationUrl, null);
}

// 9 not open
assert.equal(
  resolvePublicRegistrationState({
    now,
    eventStatus: "published",
    registrationEnabled: true,
    opensAt: new Date("2026-07-01T00:00:00.000Z"),
    closesAt: new Date("2026-12-31T00:00:00.000Z"),
    submissionDeadline: null,
    eventStartAt: null,
    capacity: null,
    confirmedCount: null,
  }),
  "not_open",
);

// 10 closed
assert.equal(
  resolvePublicRegistrationState({
    now,
    eventStatus: "published",
    registrationEnabled: true,
    opensAt: null,
    closesAt: new Date("2025-01-01T00:00:00.000Z"),
    submissionDeadline: null,
    eventStartAt: null,
    capacity: null,
    confirmedCount: null,
  }),
  "closed",
);

// 11 full
assert.equal(
  resolvePublicRegistrationState({
    now,
    eventStatus: "published",
    registrationEnabled: true,
    opensAt: new Date("2026-01-01T00:00:00.000Z"),
    closesAt: new Date("2026-12-31T00:00:00.000Z"),
    submissionDeadline: null,
    eventStartAt: null,
    capacity: 10,
    confirmedCount: 10,
  }),
  "full",
);

// 12 finished / archived
assert.equal(
  resolvePublicRegistrationState({
    now,
    eventStatus: "archived",
    registrationEnabled: true,
    opensAt: null,
    closesAt: null,
    submissionDeadline: null,
    eventStartAt: null,
    capacity: null,
    confirmedCount: null,
  }),
  "finished",
);

// 12b cancelled (señal explícita; Prisma aún sin status CANCELLED)
assert.equal(
  resolvePublicRegistrationState({
    now,
    eventStatus: "published",
    registrationEnabled: true,
    opensAt: null,
    closesAt: null,
    submissionDeadline: null,
    eventStartAt: null,
    capacity: null,
    confirmedCount: null,
    isCancelled: true,
  }),
  "cancelled",
);

// 14 paid missing price
{
  const reg = serializePublicRegistrationV1(
    { ...base, pricingMode: "PAID", priceAmountMinor: null, currency: "ARS" },
    { now, webBaseUrl: "http://localhost:3000" },
  );
  assert.equal(reg.canRegister, false);
  assert.equal(reg.displayPrice, null);
}

// 16 invalid URL
assert.equal(
  buildRegistrationHandoffUrl({
    webBaseUrl: "ftp://bad",
    slug: "demo",
  }),
  null,
);

// 19 return external rejected
assert.equal(
  isSafeClickatonReturnTo("https://evil.example/x", "http://localhost:3005"),
  false,
);
assert.equal(
  isSafeClickatonReturnTo("http://localhost:3005/maratones/demo", "http://localhost:3005"),
  true,
);
assert.equal(isSafeClickatonReturnTo("/maratones/demo", null), true);
assert.equal(isSafeClickatonReturnTo("javascript:alert(1)", null), false);

// 20 slug encoded
{
  const url = buildRegistrationHandoffUrl({
    webBaseUrl: "http://localhost:3000",
    slug: "mi-edicion",
    source: "clickaton",
  });
  assert.ok(url?.includes("/concursos/mi-edicion"));
}

console.log("public-api/v1 registration.selfcheck: OK");
