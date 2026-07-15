/**
 * Self-check del adaptador FotoRank → Clickaton (Etapa 08D, sin runner ni DB).
 * Ejecutar desde apps/clickaton:
 *   pnpm exec tsx --tsconfig tsconfig.json data/public-marathons/fotorank-adapter.selfcheck.ts
 */
import assert from "node:assert/strict";
import { createFotorankHttpPublicMarathonDataSource } from "./fotorank-http-source";
import { assertSafePublicApiBaseUrl } from "./fotorank-public-client";
import type {
  FotorankPublicEventListItemV1,
  FotorankPublicEventV1,
} from "./fotorank-v1-types";
import {
  mapFotorankCapabilitiesToClickaton,
  mapFotorankEventListItemToPublicMarathon,
  mapFotorankEventToPublicMarathon,
  toPublicHttpUrl,
} from "./map-fotorank-event";
import { mapFotorankStatusToMarathonStatus } from "./map-fotorank-status";
import { normalizePublicMarathon } from "./normalize";
import {
  parseClickatonPublicDataSourceKind,
  createHybridPublicMarathonDataSource,
} from "./resolve-source";
import { localPublicMarathonDataSource } from "./local-source";
import { canShowRegistrationCta } from "../../lib/marathons";
import {
  PublicMarathonPayloadError,
  PublicMarathonSourceUnavailableError,
} from "./errors";

const capabilities = {
  canViewRules: true,
  canViewJury: true,
  canViewCategories: true,
  canRegister: false,
  canViewResults: false,
  canViewGallery: false,
} as const;

const baseEvent: FotorankPublicEventV1 = {
  contractVersion: "v1",
  id: "evt_1",
  slug: "demo-fr",
  name: "Concurso Demo FR",
  shortDescription: "Desc corta",
  fullDescription: "Desc larga",
  experienceType: "contest",
  distributionChannel: null,
  status: "published",
  registrationStatus: "open",
  featured: false,
  organization: {
    id: "org_1",
    name: "Org Demo",
    slug: "org-demo",
    shortDescription: "Org",
    logoUrl: "https://example.com/logo.png",
    website: "https://example.com",
    city: "Rosario",
    country: "AR",
    instagram: "@org",
  },
  territory: {
    city: "Rosario",
    country: "AR",
    provinceOrRegion: "Santa Fe",
  },
  schedule: {
    startAt: "2026-06-01T12:00:00.000Z",
    submissionDeadline: "2026-12-31T12:00:00.000Z",
    judgingStartAt: null,
    judgingEndAt: null,
    resultsAt: "2027-01-15T12:00:00.000Z",
    timezone: null,
  },
  coverImageUrl: "https://example.com/cover.jpg",
  categories: [
    {
      id: "cat_1",
      name: "Libre",
      slug: "libre",
      description: null,
      maxFiles: 3,
    },
  ],
  jury: [
    {
      publicSlug: "ana-perez",
      firstName: "Ana",
      lastName: "Perez",
      displayName: "Ana Perez",
      avatarUrl: null,
      shortBio: "Fotógrafa",
      categories: ["Libre"],
    },
  ],
  rules: {
    title: "Bases",
    summary: "Resumen",
    content: "Texto de bases",
  },
  prizesSummary: "Premio principal",
  sponsorsText: null,
  resultsStatus: "scheduled",
  capabilities: { ...capabilities },
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-06-01T00:00:00.000Z",
};

// --- URL ---
assert.equal(
  assertSafePublicApiBaseUrl("https://fotorank.example.com/"),
  "https://fotorank.example.com",
);
assert.equal(
  assertSafePublicApiBaseUrl("http://localhost:3000"),
  "http://localhost:3000",
);
assert.throws(
  () => assertSafePublicApiBaseUrl("ftp://example.com"),
  (err: unknown) => err instanceof PublicMarathonPayloadError,
);
assert.throws(
  () => assertSafePublicApiBaseUrl("https://user:pass@example.com"),
  (err: unknown) =>
    err instanceof PublicMarathonPayloadError &&
    err.message.includes("credentials"),
);

// --- URL pública de assets ---
assert.equal(toPublicHttpUrl("https://cdn.example/a.jpg"), "https://cdn.example/a.jpg");
assert.equal(toPublicHttpUrl("/uploads/private.jpg"), undefined);
assert.equal(toPublicHttpUrl(null), undefined);

// --- Mapping (interno; no implica publicación) ---
const mapped = normalizePublicMarathon(
  mapFotorankEventToPublicMarathon(baseEvent, {
    now: new Date("2026-03-01T00:00:00.000Z"),
  }),
);
assert.equal(mapped.slug, "demo-fr");
assert.equal(mapped.format, "individual");
assert.equal(mapped.modality, "Concurso fotográfico");
assert.equal(mapped.coverImage, "https://example.com/cover.jpg");
assert.equal(mapped.status, "registration_open");

const json = JSON.stringify(mapped);
assert.equal(json.includes("rulesData"), false);
assert.equal(json.includes("contactEmail"), false);
assert.equal(json.includes("votes"), false);

const caps = mapFotorankCapabilitiesToClickaton("evt_1", capabilities);
assert.equal(caps.canRegister, false);
assert.equal(canShowRegistrationCta(mapped, caps), false);

assert.equal(
  mapFotorankStatusToMarathonStatus({
    status: "archived",
    registrationStatus: "closed",
    resultsStatus: "not_available",
  }),
  "archived",
);

const listItem: FotorankPublicEventListItemV1 = {
  contractVersion: "v1",
  id: "evt_1",
  slug: "demo-fr",
  name: "Concurso Demo FR",
  shortDescription: "Desc",
  experienceType: "contest",
  distributionChannel: null,
  status: "published",
  registrationStatus: "closed",
  featured: false,
  organization: {
    id: "org_1",
    name: "Org",
    slug: "org",
    logoUrl: null,
  },
  territory: { city: null, country: null, provinceOrRegion: null },
  startAt: null,
  submissionDeadline: null,
  coverImageUrl: null,
  categoryCount: 0,
  juryPublished: false,
  resultsStatus: "not_available",
  capabilities: { ...capabilities },
  updatedAt: "2025-06-01T00:00:00.000Z",
};
const listMapped = normalizePublicMarathon(
  mapFotorankEventListItemToPublicMarathon(listItem),
);
assert.equal(listMapped.registrationStatus, "closed");

// --- Resolver kind ---
assert.equal(parseClickatonPublicDataSourceKind(undefined), "fixture");
assert.equal(parseClickatonPublicDataSourceKind("fotorank"), "fotorank");
assert.throws(() => parseClickatonPublicDataSourceKind("bogus"));

async function runSourceChecks() {
  const officialMarathon: FotorankPublicEventV1 = {
    ...baseEvent,
    id: "evt_m1",
    slug: "clickaton-oficial",
    name: "Clickaton Oficial",
    experienceType: "marathon",
    distributionChannel: "clickaton",
  };
  const officialListItem: FotorankPublicEventListItemV1 = {
    ...listItem,
    id: "evt_m1",
    slug: "clickaton-oficial",
    name: "Clickaton Oficial",
    experienceType: "marathon",
    distributionChannel: "clickaton",
    registrationStatus: "open",
  };

  const listedPayload = {
    version: "v1",
    data: { items: [listItem, officialListItem] },
    meta: { count: 2 },
  };
  const detailContestPayload = {
    version: "v1",
    data: { event: baseEvent },
  };
  const detailMarathonPayload = {
    version: "v1",
    data: { event: officialMarathon },
  };

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("/api/public/v1/events?") || url.endsWith("/api/public/v1/events")) {
      // Simula filtro FR ?channel=clickaton → solo MARATHON+CLICKATON
      const channel = new URL(url).searchParams.get("channel");
      const items =
        channel === "clickaton"
          ? [officialListItem]
          : [listItem, officialListItem];
      return new Response(
        JSON.stringify({
          version: "v1",
          data: { items },
          meta: { count: items.length },
        }),
        { status: 200 },
      );
    }
    if (url.includes("/api/public/v1/events/clickaton-oficial")) {
      return new Response(JSON.stringify(detailMarathonPayload), { status: 200 });
    }
    if (url.includes("/api/public/v1/events/demo-fr")) {
      // Con channel=clickaton FR devolvería 404; sin canal, contest
      const channel = new URL(url).searchParams.get("channel");
      if (channel === "clickaton") {
        return new Response(
          JSON.stringify({
            version: "v1",
            error: { code: "EVENT_NOT_FOUND", message: "gone" },
          }),
          { status: 404 },
        );
      }
      return new Response(JSON.stringify(detailContestPayload), { status: 200 });
    }
    if (url.includes("/api/public/v1/events/missing")) {
      return new Response(
        JSON.stringify({
          version: "v1",
          error: { code: "EVENT_NOT_FOUND", message: "gone" },
        }),
        { status: 404 },
      );
    }
    if (url.includes("/api/public/v1/events/boom")) {
      return new Response("fail", { status: 500 });
    }
    if (url.includes("/api/public/v1/events/v2")) {
      return new Response(
        JSON.stringify({ version: "v2", data: { items: [] }, meta: { count: 0 } }),
        { status: 200 },
      );
    }
    return new Response("fail", { status: 500 });
  };

  const { createFotorankPublicClient } = await import("./fotorank-public-client");
  const client = createFotorankPublicClient({
    baseUrl: "http://fotorank.test",
    fetchImpl,
  });
  const source = createFotorankHttpPublicMarathonDataSource({
    baseUrl: "http://fotorank.test",
    client,
    timeoutMs: 1000,
  });

  // Solo maratón oficial (MARATHON + CLICKATON) en listado
  const listed = await source.listListed();
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.slug, "clickaton-oficial");
  assert.equal(listed[0]?.modality, "Maratón fotográfica");

  // contest no se resuelve como maratón publicable
  const detailContest = await source.getBySlug("demo-fr");
  assert.equal(detailContest, null);

  // maratón oficial sí
  const detailOfficial = await source.getBySlug("clickaton-oficial");
  assert.equal(detailOfficial?.slug, "clickaton-oficial");
  assert.equal(detailOfficial?.modality, "Maratón fotográfica");

  const missing = await source.getBySlug("missing");
  assert.equal(missing, null);

  // 500 → SourceUnavailable (no 404)
  await assert.rejects(
    async () => client.getEventBySlug("boom"),
    (err: unknown) => err instanceof PublicMarathonSourceUnavailableError,
  );

  // versión no V1 rechazada
  await assert.rejects(
    async () => {
      const badClient = createFotorankPublicClient({
        baseUrl: "http://fotorank.test",
        fetchImpl: async () =>
          new Response(
            JSON.stringify({ version: "v2", data: { items: [] }, meta: { count: 0 } }),
            { status: 200 },
          ),
      });
      await badClient.listEvents();
    },
    (err: unknown) => err instanceof PublicMarathonPayloadError,
  );

  // Hybrid: demo local + remoto con maratón oficial
  const hybrid = createHybridPublicMarathonDataSource(source, localPublicMarathonDataSource);
  const demo = await hybrid.getBySlug("demo");
  assert.ok(demo?.isDemo);
  const hybridListed = await Promise.resolve(hybrid.listListed());
  assert.equal(hybridListed.length, 1);
  assert.equal(hybridListed[0]?.slug, "clickaton-oficial");
  const routable = await Promise.resolve(hybrid.listRoutableSlugs());
  assert.ok(routable.includes("demo"));
  assert.ok(routable.includes("clickaton-oficial"));
  assert.equal(routable.includes("demo-fr"), false);

  // Timeout → SourceUnavailable (no fixture)
  const timeoutClient = createFotorankPublicClient({
    baseUrl: "http://fotorank.test",
    timeoutMs: 1,
    fetchImpl: async () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    },
  });
  const timeoutSource = createFotorankHttpPublicMarathonDataSource({
    baseUrl: "http://fotorank.test",
    client: timeoutClient,
  });
  await assert.rejects(
    async () => Promise.resolve(timeoutSource.listListed()),
    (err: unknown) =>
      err instanceof PublicMarathonSourceUnavailableError &&
      err.message.includes("timeout"),
  );

  // FR caído: listRoutableSlugs hybrid aún expone demo (SSG); listListed sigue fallando
  const deadRemote = createFotorankHttpPublicMarathonDataSource({
    baseUrl: "http://fotorank.test",
    client: timeoutClient,
  });
  const hybridDead = createHybridPublicMarathonDataSource(
    deadRemote,
    localPublicMarathonDataSource,
  );
  const routableDead = await Promise.resolve(hybridDead.listRoutableSlugs());
  assert.ok(routableDead.includes("demo"));
  await assert.rejects(
    async () => Promise.resolve(hybridDead.listListed()),
    (err: unknown) => err instanceof PublicMarathonSourceUnavailableError,
  );

  // Defensa: contest + clickaton no es oficial
  const { isOfficialClickatonMarathon } = await import(
    "./is-official-clickaton-marathon"
  );
  assert.equal(
    isOfficialClickatonMarathon({
      experienceType: "contest",
      distributionChannel: "clickaton",
    }),
    false,
  );
  assert.equal(
    isOfficialClickatonMarathon({
      experienceType: "marathon",
      distributionChannel: "clickaton",
    }),
    true,
  );
  assert.equal(
    isOfficialClickatonMarathon({
      experienceType: "marathon",
      distributionChannel: "fotorank",
    }),
    false,
  );

  void listedPayload;
}

async function main() {
  await runSourceChecks();
  console.log("fotorank-adapter.selfcheck: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
