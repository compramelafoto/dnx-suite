/**
 * Allowlist Public API — no datos privados.
 * pnpm --filter fotorank exec tsx app/lib/fotorank/release/public-api-allowlist.selfcheck.ts
 */
import assert from "node:assert/strict";
import { serializePublicEventV1, type PublicEventSerializeSource } from "../../public-api/v1/serializers";

const source: PublicEventSerializeSource = {
  id: "c1",
  slug: "santa-fe-en-foco",
  title: "Santa Fe en Foco",
  shortDescription: "test",
  fullDescription: null,
  coverImageUrl: null,
  rulesText: "Bases oficiales",
  prizesSummary: null,
  sponsorsText: null,
  rulesData: { secret: true, economy: { entryMode: "FREE" } },
  startAt: null,
  submissionDeadline: null,
  judgingStartAt: null,
  judgingEndAt: null,
  resultsAt: null,
  status: "PUBLISHED",
  visibility: "PUBLIC",
  experienceType: "CONTEST",
  distributionChannel: null,
  registrationEnabled: true,
  registrationPricingMode: "FREE",
  registrationPriceAmountMinor: 0,
  registrationCurrency: "ARS",
  registrationOpensAt: new Date("2026-08-01T03:00:00Z"),
  registrationClosesAt: new Date("2026-09-30T02:59:59Z"),
  registrationCapacity: null,
  hasOptionalMerchandise: false,
  registrationConfirmedCount: 3,
  entriesConfirmedCount: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
  organization: {
    id: "o1",
    name: "Org",
    slug: "org",
    shortDescription: null,
    logoUrl: null,
    website: null,
    city: "Santa Fe",
    country: "AR",
    instagram: null,
    contactEmail: "secret@org.com",
    phone: "123",
    whatsapp: null,
    address: "Calle privada 1",
  },
  categories: [
    { id: "k1", name: "Celular", slug: "celular", description: null, maxFiles: 1, status: "ACTIVE" },
  ],
  judges: [],
};

const event = serializePublicEventV1(source, { enforceVisibility: false });
const json = JSON.stringify(event);

assert.equal(json.includes("secret@org.com"), false);
assert.equal("contactEmail" in event.organization, false);
assert.equal("phone" in event.organization, false);
assert.equal("address" in event.organization, false);
assert.equal(json.includes("rulesData"), false);
assert.equal(json.includes("storageKey"), false);
assert.equal(json.includes("sha256"), false);
assert.equal(json.includes("paymentOrder"), false);
assert.equal(event.confirmedRegistrationCount, 3);
assert.equal(event.confirmedEntryCount, 2);

console.log(
  JSON.stringify(
    {
      ok: true,
      allowlisted: ["id", "slug", "name", "organization.public", "confirmedRegistrationCount"],
      denied: ["contactEmail", "phone", "rulesData", "storageKey", "sha256"],
    },
    null,
    2,
  ),
);
console.log("public-api-allowlist.selfcheck.ts OK");
