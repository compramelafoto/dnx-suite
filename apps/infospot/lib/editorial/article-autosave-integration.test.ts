/**
 * Integración real contra Postgres: contrato de `autosaveArticleDraftAction`
 * (vía `autosaveArticleDraftActionWithAccess`, que evita el chequeo de auth
 * basado en `next/headers` para poder correr fuera de un request de Next).
 *
 * REQUIERE una DATABASE_URL local/QA explícita — nunca usa `.env` por
 * accidente. Si no apunta a localhost/127.0.0.1, aborta sin tocar nada.
 *
 * Crea y borra sus propios artículos de fixture (título con prefijo
 * "[QA AUTOSAVE INTEGRATION TEST]"); nunca toca filas preexistentes.
 *
 * Ejecutar (ejemplo con Postgres local vía Homebrew):
 *   DATABASE_URL="postgresql://<user>@localhost:5432/dnx_infospot_qa" \
 *     pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/editorial/article-autosave-integration.test.ts
 */

import assert from "node:assert/strict";
import { prisma } from "@repo/db";
import {
  autosaveArticleDraftActionWithAccess,
  type AutosaveDraftPayload,
} from "../../app/actions/articles";
import type { InfoSpotAccessContext } from "../infospot-access";

const rawUrl = process.env.DATABASE_URL || "";
const looksLocal = /localhost|127\.0\.0\.1/.test(rawUrl);
if (!looksLocal) {
  console.error(
    "BLOQUEADO: DATABASE_URL no parece una base local/QA (localhost/127.0.0.1).\n" +
      "Este test crea y borra artículos y NUNCA debe correr contra una base remota\n" +
      "(Neon / producción / staging compartido). Configurá una Postgres local, ej.:\n" +
      "  brew services start postgresql@16\n" +
      "  createdb dnx_infospot_qa   # si no existe\n" +
      '  DATABASE_URL="postgresql://$(whoami)@localhost:5432/dnx_infospot_qa" \\\n' +
      "    pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/editorial/article-autosave-integration.test.ts",
  );
  process.exit(1);
}

const FIXTURE_PREFIX = "[QA AUTOSAVE INTEGRATION TEST]";
const fixtureArticleIds: string[] = [];
const fixtureAssetIds: string[] = [];

const fakeAccess: InfoSpotAccessContext = {
  user: { id: 1 } as InfoSpotAccessContext["user"],
  membership: null,
  subject: { role: "INFOSPOT_DIRECTOR", status: "ACTIVE" },
};

async function findFixtureAuthorId(): Promise<number> {
  // Reutiliza un authorId ya válido en esta DB — no crea usuarios de fixture.
  const anyArticle = await prisma.infoSpotArticle.findFirst({ select: { authorId: true } });
  if (anyArticle) return anyArticle.authorId;
  const anyUser = await prisma.user.findFirst({ select: { id: true } });
  assert.ok(anyUser, "La DB de QA no tiene ningún User — no se puede crear el fixture.");
  return anyUser!.id;
}

async function createFixtureArticle(params: {
  suffix: string;
  authorId: number;
  content?: string;
  withLocation?: boolean;
  eventId?: number | null;
  clfAlbumId?: number | null;
}) {
  const article = await prisma.infoSpotArticle.create({
    data: {
      title: `${FIXTURE_PREFIX} ${params.suffix}`,
      slug: `qa-autosave-integration-${params.suffix.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      content: params.content ?? "",
      authorId: params.authorId,
      status: "DRAFT",
      eventId: params.eventId ?? null,
      clfAlbumId: params.clfAlbumId ?? null,
      ...(params.withLocation
        ? {
            geographicScope: "LOCAL",
            countryCode: "AR",
            countryName: "Argentina",
            province: "Santa Fe",
            city: "Rosario",
            placeName: "Estadio Gigante",
            address: "Génova 640",
            formattedAddress: "Génova 640, Rosario, Santa Fe, Argentina",
            latitude: -32.94,
            longitude: -60.65,
          }
        : {}),
    },
  });
  fixtureArticleIds.push(article.id);
  return article;
}

async function createFixtureAsset(suffix: string) {
  const asset = await prisma.infoSpotEditorialAsset.create({
    data: {
      sourceType: "UPLOAD",
      url: `https://example.invalid/qa-fixture-${suffix}-${Date.now()}.jpg`,
      credit: `QA fixture ${suffix}`,
    },
  });
  fixtureAssetIds.push(asset.id);
  return asset;
}

function payload(overrides: Partial<AutosaveDraftPayload> = {}): AutosaveDraftPayload {
  return {
    title: "Nota de integración QA",
    slug: "nota-de-integracion-qa",
    excerpt: "",
    content: "",
    categoryId: "",
    ...overrides,
  };
}

let passed = 0;
async function scenario(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`OK  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    throw err;
  }
}

async function main() {
  const authorId = await findFixtureAuthorId();

  // --- 1. Ciclo completo: cuerpo + ubicación + portada persisten y
  // sobreviven un "reabrir" (lectura fresca, como hace /editar en el SSR). ---
  await scenario("ciclo completo: cuerpo + ubicación + portada persisten al reabrir", async () => {
    const article = await createFixtureArticle({ suffix: "ciclo-completo", authorId });
    const asset = await createFixtureAsset("ciclo-completo");

    const result = await autosaveArticleDraftActionWithAccess(
      fakeAccess,
      article.id,
      payload({
        content: "<p>Cuerpo real cargado por la redactora.</p>",
        coverImageId: asset.id,
        coverCredit: "Foto: QA",
        coverCaption: "Pie de foto QA",
        geographicScope: "LOCAL",
        countryCode: "AR",
        countryName: "Argentina",
        province: "Santa Fe",
        city: "Rosario",
        placeName: "Estadio Gigante",
        address: "Génova 640",
        formattedAddress: "Génova 640, Rosario, Santa Fe, Argentina",
        latitude: -32.94,
        longitude: -60.65,
        expectedUpdatedAt: article.updatedAt.toISOString(),
      }),
    );
    assert.equal(result.ok, true, "el guardado debe confirmarse recién con persistencia real");

    // "Reabrir desde el listado": lectura fresca e independiente del estado local.
    const reopened = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });
    assert.match(reopened.content, /Cuerpo real cargado por la redactora/);
    assert.equal(reopened.coverImageId, asset.id);
    assert.equal(reopened.city, "Rosario");
    assert.equal(reopened.geographicScope, "LOCAL");
    assert.equal(reopened.latitude, -32.94);
    assert.equal(reopened.longitude, -60.65);
  });

  // --- 2. Guardar sin modificar esos campos no los vacía ni los reenvía vacíos. ---
  await scenario("re-guardar sin tocar cuerpo/ubicación/portada los mantiene intactos", async () => {
    const article = await createFixtureArticle({
      suffix: "no-touch",
      authorId,
      content: "Cuerpo ya persistido, no se toca en este guardado.",
      withLocation: true,
    });
    const asset = await createFixtureAsset("no-touch");
    await prisma.infoSpotArticle.update({ where: { id: article.id }, data: { coverImageId: asset.id } });
    const before = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });

    // Autosave que solo cambia el título — simula edición parcial real del formulario,
    // que siempre reenvía location/coverImageId con lo que ya tenía cargado localmente.
    const result = await autosaveArticleDraftActionWithAccess(
      fakeAccess,
      article.id,
      payload({
        title: "Título actualizado únicamente",
        content: before.content,
        coverImageId: before.coverImageId,
        geographicScope: before.geographicScope ?? "",
        countryCode: before.countryCode ?? "",
        countryName: before.countryName ?? "",
        province: before.province ?? "",
        city: before.city ?? "",
        placeName: before.placeName ?? "",
        address: before.address ?? "",
        formattedAddress: before.formattedAddress ?? "",
        latitude: before.latitude ?? "",
        longitude: before.longitude ?? "",
        expectedUpdatedAt: before.updatedAt.toISOString(),
      }),
    );
    assert.equal(result.ok, true);

    const after = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });
    assert.equal(after.title, "Título actualizado únicamente");
    assert.equal(after.content, before.content);
    assert.equal(after.coverImageId, before.coverImageId);
    assert.equal(after.city, before.city);
  });

  // --- 3. Hidratación incompleta: payload con cuerpo/ubicación/portada vacíos
  // (como si el editor montara con props todavía sin llegar) NO borra lo persistido. ---
  await scenario("payload con campos vacíos (hidratación incompleta) no borra lo persistido", async () => {
    const article = await createFixtureArticle({
      suffix: "hidratacion-incompleta",
      authorId,
      content: "Cuerpo real de más de cuarenta caracteres ya guardado antes.",
      withLocation: true,
    });
    const asset = await createFixtureAsset("hidratacion-incompleta");
    await prisma.infoSpotArticle.update({ where: { id: article.id }, data: { coverImageId: asset.id } });
    const before = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });

    const result = await autosaveArticleDraftActionWithAccess(
      fakeAccess,
      article.id,
      payload({
        title: before.title,
        content: "", // como si el editor todavía no hubiera hidratado
        coverImageId: null,
        geographicScope: "",
        city: "",
        expectedUpdatedAt: before.updatedAt.toISOString(),
      }),
    );
    assert.equal(result.ok, true);

    const after = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });
    assert.equal(after.content, before.content, "el cuerpo no debe vaciarse");
    assert.equal(after.coverImageId, before.coverImageId, "la portada no debe vaciarse");
    assert.equal(after.city, before.city, "la ciudad no debe vaciarse");
    assert.equal(after.geographicScope, before.geographicScope, "el alcance no debe vaciarse");
  });

  // --- 4. Eliminación explícita: portada, ubicación y contenido SÍ pueden
  // borrarse cuando el redactor lo pide a propósito. ---
  await scenario("coverImageCleared explícito sí borra la portada", async () => {
    const article = await createFixtureArticle({ suffix: "cover-cleared", authorId });
    const asset = await createFixtureAsset("cover-cleared");
    await prisma.infoSpotArticle.update({ where: { id: article.id }, data: { coverImageId: asset.id } });
    const before = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });

    const result = await autosaveArticleDraftActionWithAccess(
      fakeAccess,
      article.id,
      payload({
        coverImageId: null,
        coverImageCleared: "1",
        expectedUpdatedAt: before.updatedAt.toISOString(),
      }),
    );
    assert.equal(result.ok, true);
    const after = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });
    assert.equal(after.coverImageId, null);
  });

  await scenario("locationCleared explícito sí borra la ubicación", async () => {
    const article = await createFixtureArticle({ suffix: "location-cleared", authorId, withLocation: true });
    const before = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });
    assert.equal(before.geographicScope, "LOCAL");

    const result = await autosaveArticleDraftActionWithAccess(
      fakeAccess,
      article.id,
      payload({
        geographicScope: "",
        city: "",
        province: "",
        latitude: "",
        longitude: "",
        locationCleared: "1",
        expectedUpdatedAt: before.updatedAt.toISOString(),
      }),
    );
    assert.equal(result.ok, true);
    const after = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });
    assert.equal(after.geographicScope, null);
    assert.equal(after.city, null);
  });

  await scenario("contentCleared explícito sí vacía el cuerpo", async () => {
    const article = await createFixtureArticle({
      suffix: "content-cleared",
      authorId,
      content: "Cuerpo que el redactor decide borrar completamente a propósito.",
    });
    const before = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });

    const result = await autosaveArticleDraftActionWithAccess(
      fakeAccess,
      article.id,
      payload({ content: "", contentCleared: "1", expectedUpdatedAt: before.updatedAt.toISOString() }),
    );
    assert.equal(result.ok, true);
    const after = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });
    assert.equal(after.content, "");
  });

  // --- 5. Concurrencia (simulación determinística): A lee una versión vieja,
  // B guarda una versión nueva primero, A llega después con su baseline vieja.
  // El resultado final debe conservar B, y A debe rechazarse explícitamente. ---
  await scenario(
    "autosave atrasado (A) no sobrescribe una versión más nueva ya guardada (B)",
    async () => {
      const article = await createFixtureArticle({
        suffix: "concurrencia-secuencial",
        authorId,
        content: "Versión original antes de la carrera.",
      });
      const baseline = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });

      // B: termina primero, con la misma versión base que A todavía tiene.
      const resultB = await autosaveArticleDraftActionWithAccess(
        fakeAccess,
        article.id,
        payload({
          content: "CONTENIDO B (más nuevo, terminó primero)",
          expectedUpdatedAt: baseline.updatedAt.toISOString(),
        }),
      );
      assert.equal(resultB.ok, true, "B debe guardar sin problema");

      // A: request atrasado que arranca con la MISMA versión base que B (baseline),
      // pero llega al servidor después de que B ya commiteó.
      const resultA = await autosaveArticleDraftActionWithAccess(
        fakeAccess,
        article.id,
        payload({
          content: "CONTENIDO A (viejo, terminó después)",
          expectedUpdatedAt: baseline.updatedAt.toISOString(),
        }),
      );
      assert.equal(resultA.ok, false, "A debe rechazarse explícitamente, no aplicarse en silencio");
      assert.match(resultA.ok ? "" : resultA.error, /versión más nueva/i);

      const final = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });
      assert.equal(final.content, "CONTENIDO B (más nuevo, terminó primero)", "debe conservarse B, no A");
    },
  );

  // --- 6. Concurrencia real (simultánea): dos requests con la misma versión
  // base disparados en paralelo — el compare-and-swap a nivel DB debe dejar
  // pasar exactamente uno y rechazar el otro (nunca los dos, nunca ninguno). ---
  await scenario("dos autosaves realmente simultáneos: exactamente uno gana", async () => {
    const article = await createFixtureArticle({
      suffix: "concurrencia-simultanea",
      authorId,
      content: "Versión original.",
    });
    const baseline = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });

    const [r1, r2] = await Promise.all([
      autosaveArticleDraftActionWithAccess(
        fakeAccess,
        article.id,
        payload({ content: "CONTENIDO RACE 1", expectedUpdatedAt: baseline.updatedAt.toISOString() }),
      ),
      autosaveArticleDraftActionWithAccess(
        fakeAccess,
        article.id,
        payload({ content: "CONTENIDO RACE 2", expectedUpdatedAt: baseline.updatedAt.toISOString() }),
      ),
    ]);

    const oks = [r1.ok, r2.ok].filter(Boolean).length;
    assert.equal(oks, 1, "exactamente un request concurrente debe ganar, nunca los dos ni ninguno");

    const final = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });
    const winnerContent = r1.ok ? "CONTENIDO RACE 1" : "CONTENIDO RACE 2";
    assert.equal(final.content, winnerContent);
  });

  // --- 7. Precedencia: un valor nuevo real en el mismo payload que una señal
  // de eliminación desactualizada gana — nunca se descarta en silencio. ---
  await scenario("valor nuevo real gana sobre una señal de eliminación en el mismo payload", async () => {
    const article = await createFixtureArticle({ suffix: "precedencia", authorId });
    const oldAsset = await createFixtureAsset("precedencia-old");
    const newAsset = await createFixtureAsset("precedencia-new");
    await prisma.infoSpotArticle.update({ where: { id: article.id }, data: { coverImageId: oldAsset.id } });
    const before = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });

    const result = await autosaveArticleDraftActionWithAccess(
      fakeAccess,
      article.id,
      payload({
        coverImageId: newAsset.id,
        coverImageCleared: "1", // señal contradictoria/residual — no debe ganar
        expectedUpdatedAt: before.updatedAt.toISOString(),
      }),
    );
    assert.equal(result.ok, true);
    const after = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });
    assert.equal(after.coverImageId, newAsset.id, "la portada nueva real no debe descartarse");
  });

  // --- 8. Bloques editoriales (figuras / video) en el cuerpo sobreviven
  // el guardado y el reabrir tal cual, sin normalización destructiva. ---
  await scenario("figuras editoriales e insertos de video en el cuerpo sobreviven intactos", async () => {
    const article = await createFixtureArticle({ suffix: "bloques-editoriales", authorId });
    const richContent = [
      "Intro.",
      "",
      '<figure data-editorial-image="true" data-asset-id="asset-99" data-credit="Foto: Redacción" data-caption="Epígrafe" class="is-editorial-figure"><img src="https://cdn.example/a.jpg" alt="Alt" loading="lazy" decoding="async" /><figcaption class="is-figcaption"><span data-caption="true" class="is-caption">Epígrafe</span><span data-credit-text="true" class="is-credit">Foto: Redacción</span></figcaption></figure>',
      "",
      '<figure data-editorial-video="true" data-provider="youtube" data-video-id="dQw4w9WgXcQ" data-url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" class="is-editorial-video"><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank" rel="noopener noreferrer" data-video-fallback="true">Ver video en YouTube</a></figure>',
      "",
      "Cierre.",
    ].join("\n");

    const result = await autosaveArticleDraftActionWithAccess(
      fakeAccess,
      article.id,
      payload({ content: richContent }),
    );
    assert.equal(result.ok, true);

    const after = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });
    assert.equal(after.content, richContent, "el cuerpo con figuras/video debe persistirse byte a byte");
  });

  // --- 9. Origen "desde cobertura CLF" (eventId/clfAlbumId ya vinculados):
  // mismo contrato de autosave, sin comportamiento especial ni pérdida. ---
  await scenario("nota originada desde cobertura CLF (eventId/clfAlbumId) respeta el mismo contrato", async () => {
    const article = await createFixtureArticle({
      suffix: "origen-clf",
      authorId,
      content: "Cuerpo importado desde una cobertura de ComprameLaFoto.",
      eventId: 999999,
      clfAlbumId: 999999,
    });
    const before = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });

    const result = await autosaveArticleDraftActionWithAccess(
      fakeAccess,
      article.id,
      payload({
        content: "", // hidratación incompleta simulada, igual que en el resto de los casos
        expectedUpdatedAt: before.updatedAt.toISOString(),
      }),
    );
    assert.equal(result.ok, true);
    const after = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });
    assert.equal(after.content, before.content, "el cuerpo importado de CLF no debe perderse");
    assert.equal(after.eventId, 999999);
    assert.equal(after.clfAlbumId, 999999);
  });

  // --- 10. Bloque de galería conviviendo con imagen suelta y video en el
  // mismo cuerpo: sobrevive el guardado byte a byte, sin perder ninguno. ---
  await scenario(
    "bloque de galería convive con imagen suelta y video existentes, sin pérdidas",
    async () => {
      const article = await createFixtureArticle({ suffix: "bloque-galeria", authorId });
      const richContent = [
        "Intro con galería.",
        "",
        '<figure data-editorial-image="true" data-asset-id="asset-99" data-credit="Foto: Redacción" data-caption="Epígrafe" class="is-editorial-figure"><img src="https://cdn.example/a.jpg" alt="Alt" loading="lazy" decoding="async" /><figcaption class="is-figcaption"><span data-caption="true" class="is-caption">Epígrafe</span><span data-credit-text="true" class="is-credit">Foto: Redacción</span></figcaption></figure>',
        "",
        '<figure data-editorial-gallery="true" class="is-editorial-gallery" data-gallery-id="gal-1" data-gallery-title="Cobertura" data-autoplay="true" data-interval-ms="5000" data-loop="true"><ol data-gallery-images="true"><li data-gallery-image="true" data-item-id="a" data-source="INFOSPOT" data-asset-id="asset-1" data-alt="Foto 1"><img src="https://cdn.example/g1.jpg" alt="Foto 1" loading="lazy" decoding="async" draggable="false"/></li><li data-gallery-image="true" data-item-id="b" data-source="CLF" data-photo-id="photo-1" data-alt="Foto 2"><img src="" alt="Foto 2" loading="lazy" decoding="async" draggable="false"/></li></ol></figure>',
        "",
        '<figure data-editorial-video="true" data-provider="youtube" data-video-id="dQw4w9WgXcQ" data-url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" class="is-editorial-video"><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank" rel="noopener noreferrer" data-video-fallback="true">Ver video en YouTube</a></figure>',
        "",
        "Cierre.",
      ].join("\n");

      const result = await autosaveArticleDraftActionWithAccess(
        fakeAccess,
        article.id,
        payload({ content: richContent }),
      );
      assert.equal(result.ok, true);

      const after = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });
      assert.equal(
        after.content,
        richContent,
        "galería + imagen suelta + video deben persistirse byte a byte, ninguno pisa al otro",
      );

      // Reguardar sin tocar el cuerpo (autosave parcial de otro campo) no debe alterarlo.
      const second = await autosaveArticleDraftActionWithAccess(
        fakeAccess,
        article.id,
        payload({ content: after.content, expectedUpdatedAt: after.updatedAt.toISOString() }),
      );
      assert.equal(second.ok, true);
      const final = await prisma.infoSpotArticle.findUniqueOrThrow({ where: { id: article.id } });
      assert.equal(final.content, richContent, "un segundo guardado no debe degradar el bloque de galería");
    },
  );

  console.log(`\n${passed} escenarios de integración OK contra ${rawUrl.replace(/:\/\/[^@]+@/, "://***@")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Limpieza: borrar únicamente los fixtures creados por esta corrida.
    if (fixtureArticleIds.length) {
      await prisma.infoSpotArticle.deleteMany({ where: { id: { in: fixtureArticleIds } } });
    }
    if (fixtureAssetIds.length) {
      await prisma.infoSpotEditorialAsset.deleteMany({ where: { id: { in: fixtureAssetIds } } });
    }
    await prisma.$disconnect();
  });
