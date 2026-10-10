/**
 * Tests de las reglas puras Muestras → InfoSpot (sin base).
 * Ejecutar: pnpm --filter infospot test:muestras-sync
 */

import assert from "node:assert/strict";
import {
  buildMuestraUpdate,
  isArgentineProvince,
  isMuestraImportable,
  normalizeMuestra,
  parseMuestrasFeed,
  type ExistingMuestraEvent,
  type MuestraFeedItem,
} from "./normalize";

let ok = 0;
function test(nombre: string, fn: () => void) {
  fn();
  ok += 1;
  console.log(`✓ ${nombre}`);
}

const item: MuestraFeedItem = {
  id: "c1", slug: "miradas", type: "MUESTRA", title: "Miradas del barrio", description: "Una muestra de fotos.",
  organizersText: "Foto Club Rosario", coverImageUrl: "https://pub.r2.dev/a.webp",
  startsAt: "2026-10-15T03:00:00.000Z", endsAt: "2026-12-04T02:59:59.999Z",
  scheduleText: "Lun a vie 10 a 18", priceText: null, isVirtualOnly: false,
  venueName: "Centro Cultural", address: "Calle 1", city: "Rosario", province: "Santa Fe",
  latitude: -32.95, longitude: -60.65, updatedAt: "2026-10-10T12:00:00.000Z",
  url: "https://muestrasfotograficas.com/m/miradas",
};

test("parseMuestrasFeed: lanza ante respuestas que no son la lista (no retira todo por un error)", () => {
  assert.throws(() => parseMuestrasFeed(null));
  assert.throws(() => parseMuestrasFeed({ error: "No pudimos armar la lista." }));
  assert.throws(() => parseMuestrasFeed({ v: 2, items: [] }));
  assert.throws(() => parseMuestrasFeed("<html>"));
});

test("parseMuestrasFeed: lista vacía válida es vacía", () => {
  assert.deepEqual(parseMuestrasFeed({ v: 1, items: [] }), []);
});

test("parseMuestrasFeed: descarta ítems rotos y urls ajenas", () => {
  const r = parseMuestrasFeed({
    v: 1,
    items: [item, { ...item, id: "" }, { ...item, id: "x", startsAt: "mañana" }, { ...item, id: "y", url: "https://otro.com/m/y" }, 7],
  });
  assert.deepEqual(r.map((x) => x.id), ["c1"]);
});

test("isMuestraImportable: virtual, sin ciudad o sin punto no se importan", () => {
  assert.equal(isMuestraImportable(item).importable, true);
  assert.equal(isMuestraImportable({ ...item, isVirtualOnly: true }).importable, false);
  assert.equal(isMuestraImportable({ ...item, city: " " }).importable, false);
  assert.equal(isMuestraImportable({ ...item, province: null }).importable, false);
  assert.equal(isMuestraImportable({ ...item, latitude: null }).importable, false);
  assert.equal(isMuestraImportable({ ...item, latitude: 0, longitude: 0 }).importable, false);
});

test("normalizeMuestra: id con prefijo, enlaces a la muestra, casilla de DNX y entrada libre", () => {
  test("isArgentineProvince: provincias argentinas sí, países no", () => {
  for (const p of ["Santa Fe", "Ciudad Autónoma de Buenos Aires", "cordoba", "Tucumán", "Tierra del Fuego, Antártida e Islas del Atlántico Sur", "Entre  Ríos"]) {
    assert.equal(isArgentineProvince(p), true, p);
  }
  for (const p of ["Uruguay", "Brasil", "Paraguay", "Bolivia", "Venezuela", "", null]) {
    assert.equal(isArgentineProvince(p), false, String(p));
  }
  assert.equal(isMuestraImportable({ ...item, city: "Montevideo", province: "Uruguay" }).importable, false);
});

const n = normalizeMuestra(item);
  assert.equal(n.externalId, "muestras:c1");
  assert.equal(n.sourceUrl, item.url);
  assert.equal(n.registrationUrl, item.url);
  assert.equal(n.organizerEmail, "muestras@dnxsuite.com");
  assert.equal(n.organizerName, "Foto Club Rosario");
  assert.equal(n.startAt.toISOString(), item.startsAt);
  assert.match(n.description, /Horarios: Lun a vie 10 a 18/);
  assert.match(n.description, /Entrada: libre y gratuita/);
  assert.match(n.description, /muestrasfotograficas\.com\/m\/miradas/);
});

test("normalizeMuestra: resumen acotado y organizador por defecto", () => {
  const largo = normalizeMuestra({ ...item, description: "palabra ".repeat(100), organizersText: " " });
  assert.ok(largo.summary!.length <= 241);
  assert.ok(largo.summary!.endsWith("…"));
  assert.equal(largo.organizerName, "Muestras Fotográficas");
});

const n = normalizeMuestra(item);
const existente: ExistingMuestraEvent = {
  title: n.title, summary: n.summary, description: n.description, categoryId: "cat", coverImageUrl: n.coverImageUrl,
  startAt: n.startAt, endAt: n.endAt, venueName: n.venueName, city: n.city, province: n.province, address: n.address,
  latitude: n.latitude, longitude: n.longitude, sourceUrl: n.sourceUrl, registrationUrl: n.registrationUrl,
  organizerName: n.organizerName, organizerWebsite: n.organizerWebsite,
  titleOverridden: false, descriptionOverridden: false, summaryOverridden: false, categoryOverridden: false,
  coverOverridden: false, locationOverridden: false, coordinatesOverridden: false,
};

test("buildMuestraUpdate: sin cambios no toca nada", () => {
  assert.deepEqual(buildMuestraUpdate(existente, n, "cat").data, {});
});

test("buildMuestraUpdate: actualiza título y fechas si no se editaron a mano", () => {
  const nuevo = normalizeMuestra({ ...item, title: "Miradas (extendida)", endsAt: "2026-12-20T02:59:59.999Z" });
  const { data } = buildMuestraUpdate(existente, nuevo, "cat");
  assert.equal(data.title, "Miradas (extendida)");
  assert.equal((data.endAt as Date).toISOString(), "2026-12-20T02:59:59.999Z");
});

test("buildMuestraUpdate: respeta lo editado a mano en InfoSpot", () => {
  const nuevo = normalizeMuestra({ ...item, title: "Otro título", description: "Otra", coverImageUrl: null, city: "Funes", latitude: -32.9 });
  const { data } = buildMuestraUpdate(
    { ...existente, titleOverridden: true, descriptionOverridden: true, summaryOverridden: true, coverOverridden: true, locationOverridden: true },
    nuevo,
    "cat",
  );
  for (const campo of ["title", "description", "summary", "coverImageUrl", "city", "latitude"]) {
    assert.equal(campo in data, false, `no debía tocar ${campo}`);
  }
});

test("buildMuestraUpdate: nunca toca el estado editorial", () => {
  const nuevo = normalizeMuestra({ ...item, title: "X", city: "Funes" });
  const { data } = buildMuestraUpdate(existente, nuevo, "otra-cat");
  for (const campo of ["status", "publishedAt", "unpublishedAt", "contentTag", "slug", "originKind"]) {
    assert.equal(campo in data, false, `no debía tocar ${campo}`);
  }
});

console.log(`\n${ok} tests OK`);
