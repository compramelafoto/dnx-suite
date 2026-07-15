/**
 * Self-check HTTP V1 (sin runner de tests ni base de datos).
 * Ejecutar: pnpm --filter fotorank exec tsx app/lib/public-api/v1/http.selfcheck.ts
 */
import assert from "node:assert/strict";
import {
  PUBLIC_API_CACHE_CONTROL_ERROR,
  PUBLIC_API_CACHE_CONTROL_SUCCESS,
  PUBLIC_API_VERSION,
  PUBLIC_API_VERSION_HEADER,
  publicApiErrorResponseV1,
  publicApiSuccessResponseV1,
  publicEventDetailResponseV1,
  publicEventsListResponseV1,
  toPublicApiErrorResponseV1,
} from "./http";
import { FotorankPublicSerializationError } from "./errors";
import { assertPublicEventSlugV1, isValidPublicEventSlugV1 } from "./slug";
import { getPublicEventVisibility } from "./visibility";
import type { FotorankPublicEventListItemV1, FotorankPublicEventV1 } from "./contracts";

async function readJson(res: Response): Promise<unknown> {
  return res.json();
}

// --- Slug ---
assert.equal(isValidPublicEventSlugV1("demo-contest"), true);
assert.equal(isValidPublicEventSlugV1("a"), true);
assert.equal(isValidPublicEventSlugV1("slug-inexistente-08b"), true);
assert.equal(isValidPublicEventSlugV1(""), false);
assert.equal(isValidPublicEventSlugV1("Invalid_Slug"), false);
assert.equal(isValidPublicEventSlugV1("has spaces"), false);
assert.equal(isValidPublicEventSlugV1("-leading"), false);
assert.equal(isValidPublicEventSlugV1("trailing-"), false);
assert.equal(isValidPublicEventSlugV1("a".repeat(101)), false);
assert.equal(assertPublicEventSlugV1("ok-slug"), "ok-slug");
assert.equal(assertPublicEventSlugV1("BAD"), null);

// --- Visibility (list vs detail) ---
assert.deepEqual(getPublicEventVisibility({ visibility: "PUBLIC", status: "PUBLISHED" }), {
  listed: true,
  routable: true,
  indexable: true,
});
assert.deepEqual(getPublicEventVisibility({ visibility: "UNLISTED", status: "PUBLISHED" }), {
  listed: false,
  routable: true,
  indexable: false,
});
assert.deepEqual(getPublicEventVisibility({ visibility: "PRIVATE", status: "PUBLISHED" }), {
  listed: false,
  routable: false,
  indexable: false,
});

// --- Envelope listado vacío (200) ---
{
  const res = publicEventsListResponseV1([]);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(res.headers.get(PUBLIC_API_VERSION_HEADER), PUBLIC_API_VERSION);
  assert.equal(res.headers.get("Cache-Control"), PUBLIC_API_CACHE_CONTROL_SUCCESS);
  const body = (await readJson(res)) as {
    version: string;
    data: { items: unknown[] };
    meta: { count: number };
  };
  assert.equal(body.version, "v1");
  assert.deepEqual(body.data.items, []);
  assert.equal(body.meta.count, 0);
}

// --- Envelope listado con ítem mock ---
{
  const item = {
    contractVersion: "v1",
    id: "evt_1",
    slug: "demo",
    name: "Demo",
    shortDescription: null,
    eventType: "contest",
    status: "published",
    registrationStatus: "unknown",
    featured: false,
    organization: { id: "o1", name: "Org", slug: "org", logoUrl: null },
    territory: { city: null, country: null, provinceOrRegion: null },
    startAt: null,
    submissionDeadline: null,
    coverImageUrl: null,
    categoryCount: 0,
    juryPublished: false,
    resultsStatus: "not_available",
    capabilities: {
      canViewRules: false,
      canViewJury: false,
      canViewCategories: false,
      canRegister: false,
      canViewResults: false,
      canViewGallery: false,
    },
    updatedAt: "2026-01-01T00:00:00.000Z",
  } satisfies FotorankPublicEventListItemV1;

  const res = publicEventsListResponseV1([item]);
  const body = (await readJson(res)) as {
    data: { items: FotorankPublicEventListItemV1[] };
    meta: { count: number };
  };
  assert.equal(body.meta.count, 1);
  assert.equal(body.data.items[0]?.slug, "demo");
  assert.equal(body.data.items[0]?.capabilities.canRegister, false);
  const json = JSON.stringify(body);
  assert.equal(json.includes("rulesData"), false);
  assert.equal(json.includes("email"), false);
  assert.equal(json.includes("votes"), false);
  assert.equal(json.includes("MARATHON"), false);
}

// --- Envelope detalle ---
{
  const event = {
    contractVersion: "v1",
    id: "evt_1",
    slug: "demo",
    name: "Demo",
    shortDescription: null,
    fullDescription: null,
    eventType: "contest",
    status: "published",
    registrationStatus: "unknown",
    featured: false,
    organization: {
      id: "o1",
      name: "Org",
      slug: "org",
      shortDescription: null,
      logoUrl: null,
      website: null,
      city: null,
      country: null,
      instagram: null,
    },
    territory: { city: null, country: null, provinceOrRegion: null },
    schedule: {
      startAt: null,
      submissionDeadline: null,
      judgingStartAt: null,
      judgingEndAt: null,
      resultsAt: null,
      timezone: null,
    },
    coverImageUrl: null,
    categories: [],
    jury: [],
    rules: null,
    prizesSummary: null,
    sponsorsText: null,
    resultsStatus: "not_available",
    capabilities: {
      canViewRules: false,
      canViewJury: false,
      canViewCategories: false,
      canRegister: false,
      canViewResults: false,
      canViewGallery: false,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } satisfies FotorankPublicEventV1;

  const res = publicEventDetailResponseV1(event);
  assert.equal(res.status, 200);
  const body = (await readJson(res)) as {
    version: string;
    data: { event: FotorankPublicEventV1 };
  };
  assert.equal(body.version, "v1");
  assert.equal(body.data.event.slug, "demo");
  assert.equal(body.data.event.eventType, "contest");
  assert.equal(body.data.event.capabilities.canViewResults, false);
  assert.equal(body.data.event.capabilities.canViewGallery, false);
}

// --- Errores públicos ---
{
  const invalid = publicApiErrorResponseV1("INVALID_REQUEST");
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get("Cache-Control"), PUBLIC_API_CACHE_CONTROL_ERROR);
  const invalidBody = (await readJson(invalid)) as {
    version: string;
    error: { code: string; message: string };
  };
  assert.equal(invalidBody.version, "v1");
  assert.equal(invalidBody.error.code, "INVALID_REQUEST");
  assert.equal(JSON.stringify(invalidBody).includes("stack"), false);
  assert.equal(JSON.stringify(invalidBody).includes("Prisma"), false);

  const notFound = publicApiErrorResponseV1("EVENT_NOT_FOUND");
  assert.equal(notFound.status, 404);
  const notFoundBody = (await readJson(notFound)) as {
    error: { code: string; message: string };
  };
  assert.equal(notFoundBody.error.code, "EVENT_NOT_FOUND");
  assert.equal(notFoundBody.error.message.includes("privado"), false);
  assert.equal(notFoundBody.error.message.includes("PRIVATE"), false);

  const internal = publicApiErrorResponseV1("INTERNAL_ERROR");
  assert.equal(internal.status, 500);
}

// --- Mapeo dominio → HTTP (PRIVATE como 404) ---
{
  const mapped = toPublicApiErrorResponseV1(
    new FotorankPublicSerializationError("NOT_PUBLIC", "Event is private"),
  );
  assert.equal(mapped.status, 404);
  const body = (await readJson(mapped)) as { error: { code: string; message: string } };
  assert.equal(body.error.code, "EVENT_NOT_FOUND");
  assert.equal(body.error.message.includes("private"), false);

  const unknown = toPublicApiErrorResponseV1(new Error("prisma boom secret"));
  assert.equal(unknown.status, 500);
  const unknownBody = (await readJson(unknown)) as {
    error: { code: string; message: string };
  };
  assert.equal(unknownBody.error.code, "INTERNAL_ERROR");
  assert.equal(JSON.stringify(unknownBody).includes("prisma"), false);
  assert.equal(JSON.stringify(unknownBody).includes("secret"), false);
}

// --- success helper genérico ---
{
  const res = publicApiSuccessResponseV1({ ok: true }, { meta: { count: 1 } });
  assert.equal(res.status, 200);
  const body = (await readJson(res)) as {
    version: string;
    data: { ok: boolean };
    meta: { count: number };
  };
  assert.equal(body.data.ok, true);
  assert.equal(body.meta.count, 1);
}

console.log("public-api/v1 http.selfcheck: OK");
