import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ARCHIVOS_DE_CONTROL,
  archivosJpgDeTrabajo,
  cursoParaArchivo,
  datosDelLibrito,
  nombreDeArchivo,
  nombreDeCara,
  nombreDelProximoLote,
  ordenDeImpresion,
  planDelLoteJpg,
} from "./produccion-reglas";

const l = (id: number, alumno: string, curso: string, colegio = "Colegio San Patricio") => ({ id, alumno, curso, colegio });

test("ordena por colegio, curso y alumno, con números de curso naturales", () => {
  const orden = ordenDeImpresion([
    l(1, "Savini Felipe", "5.º B"),
    l(2, "Alsina Justo", "5.º A"),
    l(3, "Arce Olivia", "5.º A"),
    l(4, "Zeta Ana", "10.º A"),
    l(5, "Ábalos Ema", "5.º A"),
  ]);
  assert.deepEqual(orden.map((x) => x.id), [5, 2, 3, 1, 4]);
});

test("el nombre de archivo lleva número, curso y alumno, sin caracteres prohibidos", () => {
  assert.equal(nombreDeArchivo(1, l(77, "Alsina Justo", "5.º A"), 41), "001 - 5 A - Alsina Justo (diseño 77).pdf");
  assert.equal(nombreDeArchivo(12, l(8, 'Pérez/Gómez: "Ana"', "6º B"), 1200), "0012 - 6 B - Pérez Gómez Ana (diseño 8).pdf");
});

test("el próximo lote sigue la numeración", () => {
  const fecha = new Date("2026-10-14T15:00:00Z");
  assert.equal(nombreDelProximoLote([], fecha), "Lote 1 · 14/10");
  assert.equal(nombreDelProximoLote(["Lote 2 · 10/10", "Lote 9 · 12/10", "Otro"], fecha), "Lote 10 · 14/10");
});

test("los datos del librito salen de los valores del diseño", () => {
  assert.deepEqual(
    datosDelLibrito(5, { "student.lastNameFirst": "Alsina, Justo", "course.displayName": "5.º A", "school.name": "Colegio San Patricio" }),
    { id: 5, alumno: "Alsina Justo", curso: "5.º A", colegio: "Colegio San Patricio" },
  );
  assert.deepEqual(datosDelLibrito(6, null), { id: 6, alumno: "", curso: "", colegio: "" });
});

const LIBRITO = ["Exterior (contratapa + tapa)", "Interior"];

/** Orden del Finder de Mac (y del Explorador de Windows): numérico, sin distinguir mayúsculas. */
const ordenMac = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
/** Orden ordinal (byte a byte), como lo hace `dir`/`ls` o un RIP de imprenta. */
const ordenOrdinal = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Arma un lote de `n` trabajos ya en orden de impresión y devuelve los nombres en ese orden. */
function nombresDeUnLote(n: number, caras = 2): string[] {
  const libros = ordenDeImpresion(
    Array.from({ length: n }, (_, i) =>
      l(1000 + ((i * 37) % n), `Alumno ${String.fromCharCode(65 + (i % 26))}${i}`, `${(i % 7) + 1}º ${"ABC"[i % 3]}`),
    ),
  );
  return libros.flatMap((x, i) => archivosJpgDeTrabajo(i + 1, x, libros.length, caras, LIBRITO));
}

test("JPG de un librito: las caras sueltas, con el nombre del trabajo y la cara", () => {
  assert.deepEqual(archivosJpgDeTrabajo(1, l(123, "Celoria Pedro", "7º A"), 40, 2, LIBRITO), [
    "001 - 7 A - Celoria Pedro (diseño 123) - 1 EXTERIOR (contratapa + tapa).jpg",
    "001 - 7 A - Celoria Pedro (diseño 123) - 2 INTERIOR.jpg",
  ]);
});

test("producto de una sola cara: un único JPG con el nombre del trabajo", () => {
  assert.deepEqual(archivosJpgDeTrabajo(3, l(55, "Savini Felipe", "6º A"), 3, 1, ["Hoja 1"]), [
    "003 - 6 A - Savini Felipe (diseño 55).jpg",
  ]);
  assert.deepEqual(archivosJpgDeTrabajo(3, l(55, "Savini Felipe", "6º A"), 3, 1, ["Copia"]), [
    "003 - 6 A - Savini Felipe (diseño 55) - COPIA.jpg",
  ]);
});

test("sin etiquetas en la plantilla (o las de fábrica «Hoja 1»): «1 Página 1 de 2»", () => {
  const esperado = ["001 - 1 - Ana (diseño 1) - 1 Página 1 de 2.jpg", "001 - 1 - Ana (diseño 1) - 2 Página 2 de 2.jpg"];
  assert.deepEqual(archivosJpgDeTrabajo(1, l(1, "Ana", "1º"), 1, 2, null), esperado);
  assert.deepEqual(archivosJpgDeTrabajo(1, l(1, "Ana", "1º"), 1, 2, ["Hoja 1", "  "]), esperado);
  assert.equal(nombreDeCara(0, 2, ["Tapa y Contratapa"]), "1 TAPA Y CONTRATAPA");
  // Con 10 caras o más, el número de cara se completa para que se ordenen bien.
  assert.equal(nombreDeCara(1, 12, []), "02 Página 2 de 12");
  assert.equal(nombreDeCara(1, 12, ["", "interior"]), "02 INTERIOR");
});

test("el curso se escribe sin «º» para que se vea y se ordene igual en Mac y Windows", () => {
  assert.equal(cursoParaArchivo("7º A"), "7 A");
  assert.equal(cursoParaArchivo("5.º B"), "5 B");
  assert.equal(cursoParaArchivo("1°"), "1");
  assert.equal(cursoParaArchivo("2ª C"), "2 C");
  assert.equal(cursoParaArchivo("Sala de 5"), "Sala de 5");
});

for (const n of [3, 12, 150, 1200]) {
  test(`ordenados por nombre (Mac y Windows) quedan en orden de impresión: lote de ${n}`, () => {
    const enOrden = nombresDeUnLote(n);
    assert.deepEqual([...enOrden].sort(ordenMac), enOrden);
    assert.deepEqual([...enOrden].sort(ordenOrdinal), enOrden);
    // Los archivos de control quedan primeros.
    const conControl = [...enOrden, ARCHIVOS_DE_CONTROL.leeme, ARCHIVOS_DE_CONTROL.resumen];
    for (const orden of [ordenMac, ordenOrdinal]) {
      const ordenados = [...conControl].sort(orden);
      assert.ok(ordenados.slice(0, 2).every((x) => x.startsWith("000 - ")), ordenados.slice(0, 3).join(" | "));
    }
    // Siempre el mismo ancho de número.
    const ancho = Math.max(3, String(n).length);
    for (const nombre of enOrden) assert.match(nombre, new RegExp(`^\\d{${ancho}} - `));
  });
}

test("dos alumnos con el mismo nombre en el mismo curso no se pisan ni se intercalan", () => {
  const libros = ordenDeImpresion([l(40, "Gómez Juan", "4º A"), l(12, "Gómez Juan", "4º A")]);
  const nombres = libros.flatMap((x, i) => archivosJpgDeTrabajo(i + 1, x, libros.length, 2, LIBRITO));
  assert.deepEqual(nombres, [
    "001 - 4 A - Gómez Juan (diseño 12) - 1 EXTERIOR (contratapa + tapa).jpg",
    "001 - 4 A - Gómez Juan (diseño 12) - 2 INTERIOR.jpg",
    "002 - 4 A - Gómez Juan (diseño 40) - 1 EXTERIOR (contratapa + tapa).jpg",
    "002 - 4 A - Gómez Juan (diseño 40) - 2 INTERIOR.jpg",
  ]);
  assert.equal(new Set(nombres).size, 4);
  assert.deepEqual([...nombres].sort(ordenMac), nombres);
  assert.deepEqual([...nombres].sort(ordenOrdinal), nombres);
});

test("caracteres raros y apellidos compuestos quedan legibles y válidos", () => {
  const [raro] = archivosJpgDeTrabajo(2, l(8, 'Pérez/Gómez: "Ana" <María>?', "6º B*"), 20, 1, null);
  assert.equal(raro, "002 - 6 B - Pérez Gómez Ana María (diseño 8).jpg");
  assert.doesNotMatch(raro!, /[\\/:*?"<>|]/);

  const compuesto = archivosJpgDeTrabajo(1, l(3, "De la Fuente Iturbide María José", "5º A"), 1, 2, LIBRITO);
  assert.equal(compuesto[1], "001 - 5 A - De la Fuente Iturbide María José (diseño 3) - 2 INTERIOR.jpg");

  // Acentos escritos de dos formas (NFD, como los guarda un Mac) terminan iguales.
  const [nfd] = archivosJpgDeTrabajo(1, l(4, "Núñez José", "5º A"), 1, 1, null);
  assert.equal(nfd, "001 - 5 A - Núñez José (diseño 4).jpg");

  // Un curso que termina en punto no deja un nombre que Windows no puede abrir.
  assert.equal(archivosJpgDeTrabajo(1, l(5, "Ruiz Eva.", "5to."), 1, 1, null)[0], "001 - 5to - Ruiz Eva (diseño 5).jpg");
  // Sin alumno ni curso: igual tiene nombre.
  assert.equal(archivosJpgDeTrabajo(null, l(6, "", ""), 1, 1, null)[0], "Diseño 6 (diseño 6).jpg");
});

test("nombres muy largos se cortan sin perder el número, el diseño ni la cara", () => {
  const largo = "Apellido ".repeat(30).trim();
  for (const a of archivosJpgDeTrabajo(1, l(9, largo, "5º A"), 1, 2, LIBRITO)) {
    assert.ok(a.startsWith("001 - 5 A - Apellido"));
    assert.ok(a.length < 200, `${a.length}`);
    assert.match(a, /\(diseño 9\) - [12] /);
  }
});

test("el plan del lote: todo en una carpeta, números de la lista completa y faltantes aparte", () => {
  const libros = [
    { ...l(1, "Alsina Justo", "5º A"), jpgKeys: ["e/1-a.jpg", "e/1-b.jpg"], etiquetas: LIBRITO },
    { ...l(2, "Arce Olivia", "5º A"), jpgKeys: [], etiquetas: LIBRITO },
    { ...l(3, "Bravo Ema", "5º A"), jpgKeys: ["e/3.jpg"], etiquetas: null },
  ];
  const plan = planDelLoteJpg("Lote 1 · 14/10", libros);
  assert.equal(plan.carpeta, "Lote 1 · 14-10");
  assert.deepEqual(
    plan.archivos.map((a) => [a.zipPath, a.r2Key]),
    [
      ["Lote 1 · 14-10/001 - 5 A - Alsina Justo (diseño 1) - 1 EXTERIOR (contratapa + tapa).jpg", "e/1-a.jpg"],
      ["Lote 1 · 14-10/001 - 5 A - Alsina Justo (diseño 1) - 2 INTERIOR.jpg", "e/1-b.jpg"],
      // El 002 falta, pero el 003 conserva su número: coincide con el resumen y las etiquetas.
      ["Lote 1 · 14-10/003 - 5 A - Bravo Ema (diseño 3).jpg", "e/3.jpg"],
    ],
  );
  assert.deepEqual(plan.faltantes, ["002 - 5 A - Arce Olivia (diseño 2): sin JPG final"]);
  assert.match(plan.leeme, /Colegio San Patricio\r\n {2}001 - 5 A - Alsina Justo \(diseño 1\) - 1 EXTERIOR/);
  assert.match(plan.leeme, /2 trabajos · 3 JPG/);
  assert.match(plan.leeme, /SIN ARCHIVO[\s\S]*Arce Olivia/);
});
