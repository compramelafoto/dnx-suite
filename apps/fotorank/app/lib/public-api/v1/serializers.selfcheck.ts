/**
 * Self-check local (sin runner de tests en la app).
 * Ejecutar: pnpm --filter fotorank exec tsx app/lib/public-api/v1/serializers.selfcheck.ts
 */
import assert from "node:assert/strict";
import {
  serializePublicEventListItemV1,
  serializePublicEventV1,
  type PublicEventSerializeSource,
} from "./serializers";
import { FotorankPublicSerializationError } from "./errors";
import { getPublicEventVisibility } from "./visibility";
import { deriveRegistrationStatus, mapInternalStatusToPublic } from "./status";

const base: PublicEventSerializeSource = {
  id: "evt_1",
  slug: "demo-contest",
  title: "Concurso Demo",
  shortDescription: "Desc corta",
  fullDescription: "Desc larga",
  coverImageUrl: "https://example.com/cover.jpg",
  rulesText: "Bases públicas de ejemplo.",
  prizesSummary: "Premio 1",
  sponsorsText: "Sponsor X",
  rulesData: { economy: { entryMode: "PAID", secret: "must-not-leak" } },
  startAt: new Date("2026-01-01T12:00:00.000Z"),
  submissionDeadline: new Date("2026-12-31T12:00:00.000Z"),
  judgingStartAt: null,
  judgingEndAt: null,
  resultsAt: new Date("2027-01-15T12:00:00.000Z"),
  status: "PUBLISHED",
  visibility: "PUBLIC",
  distributionChannel: null,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-06-01T00:00:00.000Z"),
  organization: {
    id: "org_1",
    name: "Org Demo",
    slug: "org-demo",
    shortDescription: "Org",
    logoUrl: null,
    website: "https://example.com",
    city: "Rosario",
    country: "AR",
    instagram: "@org",
    contactEmail: "secret@example.com",
    phone: "+541111",
    whatsapp: "+541111",
    address: "Calle privada 123",
  },
  categories: [
    {
      id: "cat_1",
      name: "Libre",
      slug: "libre",
      description: null,
      maxFiles: 3,
      status: "ACTIVE",
    },
  ],
  judges: [
    {
      firstName: "Ana",
      lastName: "Perez",
      avatarUrl: null,
      publicSlug: "ana-perez",
      shortBio: "Fotógrafa",
      categories: ["Libre"],
      isPublic: true,
    },
    {
      firstName: "Hidden",
      lastName: "Judge",
      avatarUrl: null,
      publicSlug: "hidden",
      shortBio: null,
      categories: ["Libre"],
      isPublic: false,
    },
  ],
};

const event = serializePublicEventV1(base, {
  now: new Date("2026-06-01T00:00:00.000Z"),
});

assert.equal(event.contractVersion, "v1");
assert.equal(event.experienceType, "contest");
assert.equal(event.distributionChannel, null);
assert.equal(event.name, "Concurso Demo");
assert.equal(event.organization.city, "Rosario");
assert.equal(
  "contactEmail" in event.organization,
  false,
  "organization must not expose contactEmail",
);
assert.equal(event.jury.length, 1);
assert.equal(event.jury[0]?.publicSlug, "ana-perez");
assert.ok(event.registration);
assert.equal(event.registration?.mode, "free");
assert.equal(event.registration?.canRegister, false);
assert.equal(event.registration?.checkoutUrl, null);
assert.equal(event.capabilities.canRegister, false);
assert.equal(event.capabilities.canViewResults, false);
assert.equal(event.resultsStatus, "scheduled");
assert.ok(event.rules?.content?.includes("Bases"));

const json = JSON.stringify(event);
assert.equal(json.includes("secret@example.com"), false);
assert.equal(json.includes("must-not-leak"), false);
assert.equal(json.includes("Calle privada"), false);
assert.equal(json.includes("entryMode"), false);

const listItem = serializePublicEventListItemV1(base, {
  now: new Date("2026-06-01T00:00:00.000Z"),
});
assert.equal(listItem.categoryCount, 1);
assert.equal(listItem.juryPublished, true);
assert.equal(listItem.distributionChannel, null);
assert.equal(listItem.registration?.status, event.registration?.status);
assert.equal(listItem.registration?.checkoutUrl, null);

const openReg = serializePublicEventV1(
  {
    ...base,
    experienceType: "MARATHON",
    distributionChannel: "CLICKATON",
    registrationEnabled: true,
    registrationPricingMode: "FREE",
    registrationOpensAt: new Date("2026-01-01T00:00:00.000Z"),
    registrationClosesAt: new Date("2026-12-31T00:00:00.000Z"),
  },
  {
    now: new Date("2026-06-01T00:00:00.000Z"),
    webBaseUrl: "http://localhost:3000",
  },
);
assert.equal(openReg.registration?.status, "open");
assert.equal(openReg.registration?.canRegister, true);
assert.ok(openReg.registration?.registrationUrl?.includes("source=clickaton"));
assert.equal(openReg.capabilities.canRegister, true);

const paidReg = serializePublicEventV1(
  {
    ...base,
    experienceType: "MARATHON",
    distributionChannel: "CLICKATON",
    registrationEnabled: true,
    registrationPricingMode: "PAID",
    registrationPriceAmountMinor: 150000,
    registrationCurrency: "ARS",
    hasOptionalMerchandise: true,
    registrationOpensAt: new Date("2026-01-01T00:00:00.000Z"),
    registrationClosesAt: new Date("2026-12-31T00:00:00.000Z"),
  },
  {
    now: new Date("2026-06-01T00:00:00.000Z"),
    webBaseUrl: "http://localhost:3000",
  },
);
assert.equal(paidReg.registration?.mode, "paid");
assert.equal(paidReg.registration?.displayPrice?.amountMinor, 150000);
assert.equal(paidReg.registration?.hasOptionalMerchandise, true);

const clickatonEvent = serializePublicEventV1({
  ...base,
  experienceType: "MARATHON",
  distributionChannel: "CLICKATON",
});
assert.equal(clickatonEvent.experienceType, "marathon");
assert.equal(clickatonEvent.distributionChannel, "clickaton");

const fotorankEvent = serializePublicEventV1({
  ...base,
  distributionChannel: "FOTORANK",
});
assert.equal(fotorankEvent.experienceType, "contest");
assert.equal(fotorankEvent.distributionChannel, "fotorank");

const marathonExternal = serializePublicEventV1({
  ...base,
  experienceType: "MARATHON",
  distributionChannel: null,
});
assert.equal(marathonExternal.experienceType, "marathon");
assert.equal(marathonExternal.distributionChannel, null);

assert.throws(
  () =>
    serializePublicEventV1({
      ...base,
      visibility: "PRIVATE",
    }),
  (err: unknown) => err instanceof FotorankPublicSerializationError && err.code === "NOT_PUBLIC",
);

assert.deepEqual(getPublicEventVisibility({ visibility: "UNLISTED", status: "PUBLISHED" }), {
  listed: false,
  routable: true,
  indexable: false,
});

assert.equal(mapInternalStatusToPublic("ACTIVE"), "published");
assert.equal(
  deriveRegistrationStatus({
    now: new Date("2026-06-01T00:00:00.000Z"),
    startAt: null,
    submissionDeadline: new Date("2025-01-01T00:00:00.000Z"),
    eventStatus: "published",
  }),
  "closed",
);

console.log("public-api/v1 serializers.selfcheck: OK");
