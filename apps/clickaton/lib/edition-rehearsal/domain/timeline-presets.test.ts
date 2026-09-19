import assert from "node:assert/strict";
import test from "node:test";

import { fixedClock } from "@/lib/timeline/clock";
import { COMIENZA, edicionSana, MOMENTO_DE_PRUEBA } from "./fixtures";
import { calcularAtajosDeReloj } from "./timeline-presets";

const AHORA = fixedClock(MOMENTO_DE_PRUEBA);

function atajo(foto: Parameters<typeof calcularAtajosDeReloj>[0], id: string) {
  return calcularAtajosDeReloj(foto, AHORA).find((a) => a.id === id);
}

test("el atajo de ahora usa el reloj que se le pasa", () => {
  const encontrado = atajo(edicionSana(), "ahora");
  assert.equal(encontrado?.momento?.toISOString(), MOMENTO_DE_PRUEBA.toISOString());
});

test("el atajo de inicio de la maratón usa la fecha de comienzo", () => {
  const encontrado = atajo(edicionSana(), "inicio-de-la-maraton");
  assert.equal(encontrado?.momento?.toISOString(), COMIENZA.toISOString());
});

test("la liberación de consignas sale del evento del cronograma", () => {
  const encontrado = atajo(edicionSana(), "liberacion-de-consignas");
  assert.equal(encontrado?.momento?.toISOString(), COMIENZA.toISOString());
});

test("si una consigna ya se liberó, ese instante manda sobre lo planificado", () => {
  const liberadaEl = new Date("2026-10-10T19:07:00.000Z");
  const encontrado = atajo(
    edicionSana({
      consignas: edicionSana().consignas.map((c) => ({ ...c, liberadaEl })),
    }),
    "liberacion-de-consignas",
  );
  assert.equal(encontrado?.momento?.toISOString(), liberadaEl.toISOString());
});

test("el cierre de captura sale de la consigna", () => {
  const encontrado = atajo(edicionSana(), "cierre-de-captura");
  assert.equal(encontrado?.momento?.toISOString(), "2026-10-10T22:00:00.000Z");
});

test("el cierre de subida sale de la consigna", () => {
  const encontrado = atajo(edicionSana(), "cierre-de-subida");
  assert.equal(encontrado?.momento?.toISOString(), "2026-10-10T23:00:00.000Z");
});

test("el momento entre captura y subida cae en esa franja", () => {
  const encontrado = atajo(edicionSana(), "entre-captura-y-subida");
  const t = encontrado?.momento?.getTime() ?? 0;
  assert.ok(t > new Date("2026-10-10T22:00:00.000Z").getTime(), "debe ser después del cierre de captura");
  assert.ok(t < new Date("2026-10-10T23:00:00.000Z").getTime(), "debe ser antes del cierre de subida");
});

test("la mitad de la captura cae entre la apertura y el cierre", () => {
  const encontrado = atajo(edicionSana(), "mitad-de-la-captura");
  const t = encontrado?.momento?.getTime() ?? 0;
  assert.ok(t > COMIENZA.getTime());
  assert.ok(t < new Date("2026-10-10T22:00:00.000Z").getTime());
});

test("el minuto antes del cierre de inscripción es anterior al cierre", () => {
  const encontrado = atajo(edicionSana(), "antes-del-cierre-de-inscripcion");
  assert.equal(encontrado?.momento?.toISOString(), "2026-10-09T23:58:00.000Z");
});

test("un cronograma incompleto devuelve el atajo con momento nulo y no rompe", () => {
  const encontrado = atajo(edicionSana({ comienzaEl: null }), "inicio-de-la-maraton");
  assert.ok(encontrado, "el atajo tiene que seguir existiendo");
  assert.equal(encontrado.momento, null);
});

test("una edición sin nada cargado devuelve todos los atajos, sólo con ahora resuelto", () => {
  const vacia = edicionSana({
    comienzaEl: null,
    terminaEl: null,
    inscripcionAbreEl: null,
    inscripcionCierraEl: null,
    eventos: [],
    consignas: [],
  });
  const atajos = calcularAtajosDeReloj(vacia, AHORA);
  assert.ok(atajos.length > 1);
  const conMomento = atajos.filter((a) => a.momento !== null);
  assert.deepEqual(
    conMomento.map((a) => a.id),
    ["ahora"],
  );
});

test("los atajos resueltos vienen ordenados cronológicamente", () => {
  const tiempos = calcularAtajosDeReloj(edicionSana(), AHORA)
    .filter((a) => a.momento !== null)
    .map((a) => a.momento!.getTime());
  assert.deepEqual(tiempos, [...tiempos].sort((a, b) => a - b));
});

test("cada atajo explica por qué está ahí", () => {
  for (const a of calcularAtajosDeReloj(edicionSana(), AHORA)) {
    assert.ok(a.etiqueta.trim().length > 0, `el atajo ${a.id} no tiene etiqueta`);
    assert.ok(a.porQue.trim().length > 0, `el atajo ${a.id} no explica por qué`);
  }
});

test("los identificadores de los atajos no se repiten", () => {
  const ids = calcularAtajosDeReloj(edicionSana(), AHORA).map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});
