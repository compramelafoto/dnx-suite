/**
 * Guest identity: reserva sin crear User; existing candidate; no upsert prematuro.
 * Ejecutar: pnpm --filter clickaton selfcheck:guest-registration-identity
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicRegistrationService } from "../lib/public-registration/application/public-registration-service";
import {
  createInMemoryPublicRegistrationRepository,
  createInMemoryPublicStore,
  seedPublicEdition,
  seedPublicTicket,
  seedPublicVariant,
  seedPublicVenue,
} from "../lib/public-registration/infrastructure/in-memory-public-registration-repository";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`guest-registration-identity.selfcheck: ${msg}`);
}

async function main() {
  const store = createInMemoryPublicStore();
  const now = Date.now();
  seedPublicEdition(store, {
    id: "ed1",
    slug: "guest-id-2026",
    name: "Guest ID 2026",
    shortDescription: "Demo",
    status: "REGISTRATION_OPEN",
    isPublished: true,
    registrationEnabled: true,
    registrationOpenAt: new Date(now - 86_400_000),
    registrationCloseAt: new Date(now + 86_400_000 * 30),
    startAt: new Date(now + 86_400_000 * 60),
    endAt: new Date(now + 86_400_000 * 61),
    timezone: "America/Argentina/Buenos_Aires",
    visibleCodePrefix: "GID",
  });
  seedPublicVenue(store, {
    id: "v1",
    editionId: "ed1",
    name: "Plaza",
    city: "CABA",
    province: "CABA",
    address: null,
    startAt: null,
    isActive: true,
  });
  seedPublicTicket(store, {
    id: "t1",
    editionId: "ed1",
    venueId: "v1",
    name: "General",
    description: null,
    code: "GENERAL",
    priceAmount: 25000_00,
    currency: "ARS",
    capacity: 50,
    holdMinutes: 20,
    salesStartAt: new Date(now - 1000),
    salesEndAt: new Date(now + 86_400_000 * 10),
    isActive: true,
    products: [],
  });
  seedPublicVariant(store, {
    id: "var1",
    productId: "p1",
    name: "M",
    sku: "M",
    stock: 10,
  });

  store.usersByEmail.set("existente@example.com", 42);

  const repo = createInMemoryPublicRegistrationRepository(store);
  const service = createPublicRegistrationService({ repo });

  const idNew = await repo.resolveIdentityCandidate("nuevo@example.com");
  assert(idNew.userId === null && idNew.existingUserCandidate === false, "new candidate");

  const idExisting = await repo.resolveIdentityCandidate("existente@example.com");
  assert(idExisting.userId === 42 && idExisting.existingUserCandidate === true, "existing");

  await repo.resolveIdentityCandidate("never-created@example.com");
  assert(!store.usersByEmail.has("never-created@example.com"), "no create on lookup");

  const usersBefore = store.usersByEmail.size;
  const created = await service.createRegistration({
    editionSlug: "guest-id-2026",
    venueId: "v1",
    ticketTypeId: "t1",
    variantChoices: [],
    participant: {
      firstName: "Nueva",
      lastName: "Guest",
      email: "nueva.guest@example.com",
      phone: "3415551234",
      documentNumber: "30999888",
      city: "CABA",
      province: "CABA",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: true,
    instagramHandle: "@nueva.guest",
    profilePhotoAssetId: "asset_x",
    imageUsageConsent: true,
    socialPublicationConsent: true,
    idempotencyKey: "guest-id-key-1",
  });

  assert(created.registrationId.length > 0, "registration created");
  assert(store.usersByEmail.size === usersBefore, "no User created on guest reserve");
  assert(!store.usersByEmail.has("nueva.guest@example.com"), "guest email not in users map");

  const reg = await repo.getRegistration(created.registrationId);
  assert(reg != null, "reg exists");
  assert(reg!.userId === null, "userId null until post-pay link");

  const withExisting = await service.createRegistration({
    editionSlug: "guest-id-2026",
    venueId: "v1",
    ticketTypeId: "t1",
    variantChoices: [],
    participant: {
      firstName: "Existente",
      lastName: "User",
      email: "existente@example.com",
      phone: "3415559876",
      documentNumber: "30111222",
      city: "CABA",
      province: "CABA",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: true,
    instagramHandle: "@existente",
    profilePhotoAssetId: "asset_y",
    imageUsageConsent: true,
    socialPublicationConsent: true,
    idempotencyKey: "guest-id-key-2",
  });
  const regExisting = await repo.getRegistration(withExisting.registrationId);
  assert(regExisting?.userId === 42, "existing User linked without create");
  assert(store.usersByEmail.size === usersBefore, "still no new User rows");

  const root = process.cwd();
  const prismaRepo = readFileSync(
    join(root, "lib/public-registration/infrastructure/prisma-public-registration-repository.ts"),
    "utf8",
  );
  assert(!prismaRepo.includes("user.upsert"), "no user.upsert in public repo");
  assert(prismaRepo.includes("resolveIdentityCandidate"), "resolveIdentityCandidate present");
  assert(prismaRepo.includes("PHASE_CAPACITY_EXCEEDED"), "phase capacity in create path");

  const linkSrc = readFileSync(
    join(root, "lib/registration/application/link-registration-identity.ts"),
    "utf8",
  );
  assert(linkSrc.includes("resolveOrCreateUser"), "post-pay uses resolveOrCreateUser");
  assert(!linkSrc.includes("hashPassword"), "no silent password hashing");
  assert(!/password:\s*["'`]/.test(linkSrc), "no literal password assignment");

  console.log("guest-registration-identity.selfcheck: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
