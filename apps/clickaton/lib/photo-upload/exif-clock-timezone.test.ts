/**
 * La prueba que faltaba: correr la lectura del EXIF en la zona horaria de un
 * teléfono argentino en vez de la del servidor.
 *
 * Todo el resto de los tests del reloj corre con `TZ=UTC` (o con la zona de
 * quien los corra), y ahí la doble corrección de zona horaria no se ve: el
 * defecto sólo aparece cuando el runtime NO está en UTC, que es exactamente
 * el caso del navegador del participante. Por eso este archivo tiene su
 * propio script de npm, que fija `TZ=America/Argentina/Cordoba`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  interpretExifClock,
  normalizeExifDateToUtcNumbers,
  parseExifOffset,
} from "./exif-clock";

const ZONA = "America/Argentina/Cordoba";

/** 12/12/2026, 10:00 en Córdoba = 13:00 UTC. El día de la Clickatón. */
const INSTANTE_REAL = Date.parse("2026-12-12T13:00:00.000Z");

/**
 * Lo mismo que hace `exifr` al revivir `DateTimeOriginal`: toma los números
 * del reloj de la cámara y arma un `Date` con el constructor local, o sea en
 * la zona horaria del runtime.
 */
function revivirComoExifr(
  anio: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
): Date {
  const fecha = new Date(anio, mes - 1, dia);
  fecha.setHours(hora, minuto, 0, 0);
  return fecha;
}

test("este archivo corre en la zona de Argentina, si no no prueba nada", () => {
  // Se mira el desfasaje y no el nombre de la zona: Node resuelve
  // "America/Argentina/Cordoba" al alias "America/Cordoba", y lo que importa
  // acá es que el runtime esté 3 horas al oeste de UTC, como el teléfono del
  // participante. Argentina no tiene horario de verano, así que las dos
  // fechas tienen que dar lo mismo.
  const zonaResuelta = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const pista = `zona resuelta: ${zonaResuelta}. Correr con \`npm run test:exif-clock-timezone\`, que fija TZ=${ZONA}: si da 0, la variable no llegó al proceso y este archivo pasa siempre sin probar nada.`;

  assert.equal(new Date(2026, 11, 12, 10, 0).getTimezoneOffset(), 180, pista);
  assert.equal(new Date(2026, 5, 12, 10, 0).getTimezoneOffset(), 180, pista);
});

test("en un teléfono argentino, una foto recién sacada no sale con el reloj corrido", () => {
  const exifDelNavegador = revivirComoExifr(2026, 12, 12, 10, 0);
  assert.equal(
    exifDelNavegador.getTime(),
    INSTANTE_REAL,
    "en la zona del teléfono, lo que devuelve `exifr` YA es el instante real: por eso volver a corregirlo rompe",
  );

  const captura = interpretExifClock({
    exifDate: normalizeExifDateToUtcNumbers(exifDelNavegador),
    timeZone: ZONA,
  });

  assert.ok(captura, "tiene que interpretar la fecha");
  assert.equal(
    Math.round((captura.getTime() - INSTANTE_REAL) / 60_000),
    0,
    "sin `normalizeExifDateToUtcNumbers` esto da +180 y el veredicto es CLOCK_OFF para todo participante argentino bien configurado",
  );
});

test("tampoco con OffsetTimeOriginal, que es la rama por la que entra todo iPhone", () => {
  const exifDelNavegador = revivirComoExifr(2026, 12, 12, 10, 0);

  const captura = interpretExifClock({
    exifDate: normalizeExifDateToUtcNumbers(exifDelNavegador),
    timeZone: ZONA,
    exifOffsetMinutes: parseExifOffset("-03:00"),
  });

  assert.ok(captura, "tiene que interpretar la fecha");
  assert.equal(
    Math.round((captura.getTime() - INSTANTE_REAL) / 60_000),
    0,
    "las DOS ramas de interpretExifClock fallaban igual: tener OffsetTimeOriginal no salvaba al iPhone",
  );
});

test("el helper compartido sigue siendo correcto con números-en-UTC: el camino del servidor no cambia", () => {
  // Así es como llega la fecha en Vercel, donde el proceso corre con TZ=UTC.
  const numerosComoUtc = new Date(Date.UTC(2026, 11, 12, 10, 0, 0));

  const captura = interpretExifClock({ exifDate: numerosComoUtc, timeZone: ZONA });

  assert.ok(captura, "tiene que interpretar la fecha");
  assert.equal(
    captura.getTime(),
    INSTANTE_REAL,
    "`interpretExifClock` no depende de la zona del runtime: la normalización va en la LECTURA del navegador, no acá adentro",
  );
});

test("la normalización no inventa fechas cuando no hay nada que normalizar", () => {
  assert.equal(normalizeExifDateToUtcNumbers(null), null, "sin fecha no hay fecha");
  assert.equal(
    normalizeExifDateToUtcNumbers(new Date("no es una fecha")),
    null,
    "una fecha inválida tiene que volver null, no un NaN que se cuele como instante",
  );
});
