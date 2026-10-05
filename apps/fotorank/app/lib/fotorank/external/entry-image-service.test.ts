import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

import { signEntryImageUrl } from "./entry-image-signing";
import { serveEntryImage, type EntryImageRecord, type EntryImageDeps } from "./entry-image-service";

const SECRET = "secreto-de-prueba-de-la-ruta";
const AHORA = new Date("2026-10-05T12:00:00Z");
const EN_10_MIN = new Date(AHORA.getTime() + 10 * 60 * 1000);

async function imagenDePrueba(width: number, height: number, conExif = false): Promise<Buffer> {
  const img = sharp({ create: { width, height, channels: 3, background: { r: 120, g: 120, b: 120 } } }).jpeg();
  if (conExif) return img.withExif({ IFD0: { Copyright: "Autor Secreto", Artist: "Autor Secreto" } }).toBuffer();
  return img.toBuffer();
}

function registro(over: Partial<EntryImageRecord> = {}): EntryImageRecord {
  return {
    entryId: "entry-1",
    entryNumber: "SFE-E-000123",
    status: "CONFIRMED",
    withdrawnAt: null,
    original: { storageKey: "k/original", mimeType: "image/jpeg", extension: "jpg" },
    juryPreview: { storageKey: "k/jury" },
    ...over,
  };
}

function deps(objetos: Record<string, Buffer>, rec: EntryImageRecord | null = registro(), over: Partial<EntryImageDeps> = {}) {
  const leidas: string[] = [];
  const d: EntryImageDeps = {
    secret: SECRET,
    now: AHORA,
    async loadEntry(id) {
      return rec && rec.entryId === id ? rec : null;
    },
    async readObject(key) {
      leidas.push(key);
      const b = objetos[key];
      if (!b) throw new Error("no existe");
      return new Uint8Array(b);
    },
    ...over,
  };
  return { d, leidas };
}

function query(input: { entryId?: string; variant: "preview" | "original"; wm?: string; expiresAt?: Date; secret?: string }) {
  const url = signEntryImageUrl({
    baseUrl: "https://fotorank.com",
    entryId: input.entryId ?? "entry-1",
    variant: input.variant,
    expiresAt: input.expiresAt ?? EN_10_MIN,
    secret: input.secret ?? SECRET,
    wm: input.wm,
  });
  return new URL(url).searchParams;
}

test("preview: usa el JURY_PREVIEW, achica a 1600 px, JPEG sin metadatos y con marca de agua", async () => {
  const jury = await imagenDePrueba(2000, 1333, true);
  const { d, leidas } = deps({ "k/jury": jury, "k/original": await imagenDePrueba(10, 10) });
  const r = await serveEntryImage(query({ variant: "preview", wm: "Muestra · Sociedad Fotográfica" }), d);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(leidas, ["k/jury"]);
  assert.equal(r.headers["Content-Type"], "image/jpeg");
  assert.equal(r.headers["Cache-Control"], "private, max-age=300");
  const meta = await sharp(r.body).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 1600);
  assert.equal(meta.height, 1066);
  assert.equal(meta.exif, undefined);
  // La imagen de entrada es de un solo color: si la marca de agua se dibujó, ya no lo es.
  const stats = await sharp(r.body).stats();
  assert.ok(stats.channels[0]!.stdev > 3, `stdev ${stats.channels[0]!.stdev}`);
});

test("preview sin marca de agua no dibuja nada", async () => {
  const { d } = deps({ "k/jury": await imagenDePrueba(800, 600) });
  const r = await serveEntryImage(query({ variant: "preview" }), d);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const meta = await sharp(r.body).metadata();
  assert.equal(meta.width, 800); // no agranda
  const stats = await sharp(r.body).stats();
  assert.ok(stats.channels[0]!.stdev < 3);
});

test("preview: sin JURY_PREVIEW usa el ORIGINAL", async () => {
  const { d, leidas } = deps({ "k/original": await imagenDePrueba(3000, 2000) }, registro({ juryPreview: null }));
  const r = await serveEntryImage(query({ variant: "preview", wm: "Muestra" }), d);
  assert.equal(r.ok, true);
  assert.deepEqual(leidas, ["k/original"]);
});

test("original: bytes intactos, descarga con el número de obra y sin caché", async () => {
  const original = await imagenDePrueba(50, 40, true);
  const { d } = deps({ "k/original": original });
  const r = await serveEntryImage(query({ variant: "original" }), d);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(r.body.equals(original));
  assert.equal(r.headers["Content-Type"], "image/jpeg");
  assert.equal(r.headers["Cache-Control"], "private, no-store");
  assert.equal(r.headers["Content-Disposition"], 'attachment; filename="SFE-E-000123.jpg"');
});

test("original sin número de obra usa el id y la extensión guardada", async () => {
  const { d } = deps(
    { "k/original": Buffer.from("tiff") },
    registro({ entryNumber: null, original: { storageKey: "k/original", mimeType: "image/tiff", extension: ".TIF" } }),
  );
  const r = await serveEntryImage(query({ variant: "original" }), d);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.headers["Content-Disposition"], 'attachment; filename="entry-1.tif"');
  assert.equal(r.headers["Content-Type"], "image/tiff");
});

test("cualquier falla es un 404 genérico", async () => {
  const objetos = { "k/jury": await imagenDePrueba(100, 100), "k/original": await imagenDePrueba(100, 100) };
  const casos: [string, URLSearchParams, EntryImageDeps][] = [
    ["sin secreto", query({ variant: "preview" }), deps(objetos, registro(), { secret: undefined }).d],
    ["secreto vacío", query({ variant: "preview" }), deps(objetos, registro(), { secret: "" }).d],
    ["firma de otro secreto", query({ variant: "preview", secret: "otro" }), deps(objetos).d],
    ["vencida", query({ variant: "preview", expiresAt: new Date(AHORA.getTime() - 1000) }), deps(objetos).d],
    ["obra inexistente", query({ variant: "preview", entryId: "otra" }), deps(objetos).d],
    ["retirada", query({ variant: "original" }), deps(objetos, registro({ status: "WITHDRAWN" })).d],
    ["rechazada", query({ variant: "preview" }), deps(objetos, registro({ status: "REJECTED" })).d],
    ["retirada con fecha", query({ variant: "preview" }), deps(objetos, registro({ withdrawnAt: new Date() })).d],
    ["sin original", query({ variant: "original" }), deps(objetos, registro({ original: null })).d],
    ["sin ningún archivo", query({ variant: "preview" }), deps(objetos, registro({ original: null, juryPreview: null })).d],
    ["storage falla", query({ variant: "preview" }), deps({}).d],
    ["no es imagen", query({ variant: "preview" }), deps({ "k/jury": Buffer.from("basura") }).d],
  ];
  for (const [nombre, q, d] of casos) {
    const r = await serveEntryImage(q, d);
    assert.deepEqual(r, { ok: false }, nombre);
  }
});

test("parámetro alterado después de firmar: 404", async () => {
  const { d } = deps({ "k/jury": await imagenDePrueba(100, 100) });
  const q = query({ variant: "preview", wm: "Muestra" });
  q.set("wm", "");
  assert.deepEqual(await serveEntryImage(q, d), { ok: false });
  const q2 = query({ variant: "preview" });
  q2.set("variant", "original");
  assert.deepEqual(await serveEntryImage(q2, d), { ok: false });
});

test("la marca de agua escapa XML (no rompe el SVG)", async () => {
  const { d } = deps({ "k/jury": await imagenDePrueba(400, 300) });
  const r = await serveEntryImage(query({ variant: "preview", wm: `<svg>&"'</svg>` }), d);
  assert.equal(r.ok, true);
});
