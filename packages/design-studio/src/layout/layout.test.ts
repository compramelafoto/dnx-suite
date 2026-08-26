import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildLayoutPlan, type TextMeasurer } from "./plan";
import { wrapText } from "./wrap";
import { readDesignDocument } from "../document/migrate";

/** Medidor de prueba: cada carácter mide 0,5 del cuerpo. Determinista y suficiente. */
const medidor: TextMeasurer = {
  widthOf: (texto, _fontId, _slot, sizePt) => texto.length * sizePt * 0.5,
};

function carnet() {
  const raw = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../document/__fixtures__/carnet-v1.json", import.meta.url)),
      "utf8",
    ),
  ) as unknown;
  const r = readDesignDocument(raw);
  if (!r.ok) throw new Error(r.errors.join(" | "));
  return r.value;
}

const resueltas = {
  values: {
    fullName: "Daniel Cuart",
    memberNumber: "128",
    category: "Activo",
    validUntil: "26/08/2028",
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
    photo: "socios/128/foto.jpg",
  },
  omitted: [] as string[],
};

test("corta el texto en lineas que entran en el ancho", () => {
  const lineas = wrapText("uno dos tres cuatro", 30, (t) => t.length * 2, undefined);
  assert.ok(lineas.length > 1);
  assert.equal(lineas.join(" "), "uno dos tres cuatro");
});

test("una palabra mas ancha que la caja ocupa su propia linea sin colgarse", () => {
  const lineas = wrapText("inconmensurablemente", 10, (t) => t.length * 2, undefined);
  assert.deepEqual(lineas, ["inconmensurablemente"]);
});

test("respeta los saltos de linea escritos a mano", () => {
  const lineas = wrapText("uno\ndos", 1000, (t) => t.length, undefined);
  assert.deepEqual(lineas, ["uno", "dos"]);
});

test("produce una pagina por cara, en orden", () => {
  const r = buildLayoutPlan(carnet(), resueltas, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  assert.equal(r.value.pages.length, 2);
  assert.equal(r.value.pages[0]?.sideId, "frente");
  assert.equal(r.value.pages[1]?.sideId, "dorso");
});

test("convierte milimetros a puntos: 85,6 mm son 242,6 puntos", () => {
  const r = buildLayoutPlan(carnet(), resueltas, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(Math.round((r.value.pages[0]?.widthPt ?? 0) * 10) / 10, 242.6);
});

test("con sangrado la pagina crece y el contenido se corre", () => {
  const sin = buildLayoutPlan(carnet(), resueltas, { measurer: medidor, includeBleed: false });
  const con = buildLayoutPlan(carnet(), resueltas, { measurer: medidor, includeBleed: true });
  assert.equal(sin.ok && con.ok, true);
  if (!sin.ok || !con.ok) return;
  const anchoSin = sin.value.pages[0]?.widthPt ?? 0;
  const anchoCon = con.value.pages[0]?.widthPt ?? 0;
  // 3 mm por lado = 6 mm = 17,01 puntos
  assert.ok(Math.abs(anchoCon - anchoSin - 17.008) < 0.01, `creció ${anchoCon - anchoSin}`);
  const xSin = sin.value.pages[0]?.items[0]?.xPt ?? 0;
  const xCon = con.value.pages[0]?.items[0]?.xPt ?? 0;
  assert.ok(Math.abs(xCon - xSin - 8.504) < 0.01);
});

test("interpola las variables en el texto", () => {
  const r = buildLayoutPlan(carnet(), resueltas, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const nombre = r.value.pages[0]?.items.find((i) => i.id === "nombre");
  assert.ok(nombre && nombre.kind === "text");
  if (!nombre || nombre.kind !== "text") return;
  assert.equal(nombre.lines.join(" "), "Daniel Cuart");
});

test("el bloque QR toma su contenido de la variable declarada", () => {
  const r = buildLayoutPlan(carnet(), resueltas, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const qr = r.value.pages[1]?.items.find((i) => i.id === "qr");
  assert.ok(qr && qr.kind === "qr");
  if (!qr || qr.kind !== "qr") return;
  assert.equal(qr.payload, "https://fotoffice.com/c/AB12CD34");
});

test("marca desbordado el texto que no entra en las lineas permitidas", () => {
  const largo = {
    ...resueltas,
    values: { ...resueltas.values, fullName: "Daniel Alejandro Cuart de la Fuente y Martínez" },
  };
  const r = buildLayoutPlan(carnet(), largo, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const nombre = r.value.pages[0]?.items.find((i) => i.id === "nombre");
  assert.ok(nombre && nombre.kind === "text" && nombre.overflow === true);
});

test("omite los bloques ocultos", () => {
  const conOculto = carnet();
  const frente = conOculto.sides[0];
  if (frente?.blocks[1]) frente.blocks[1].hidden = true;
  const r = buildLayoutPlan(conOculto, resueltas, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.pages[0]?.items.length, 5);
});

test("falla si un bloque usa una tipografia que no esta en el catalogo", () => {
  const roto = carnet();
  const bloque = roto.sides[0]?.blocks[1];
  if (bloque && bloque.type === "text") bloque.fontId = "comicSans";
  const r = buildLayoutPlan(roto, resueltas, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /comicSans/);
});

test("falla si el QR apunta a una variable que no llego", () => {
  const sinQr = { ...resueltas, values: { ...resueltas.values, verificationUrl: "" } };
  const r = buildLayoutPlan(carnet(), sinQr, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /verificationUrl/);
});
