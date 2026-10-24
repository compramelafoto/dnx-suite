import assert from "node:assert/strict";
import test from "node:test";
import {
  COURSE_MOSAIC_SAMPLE,
  distributeCourseMosaic,
  DEFAULT_COURSE_MOSAIC_OPTIONS,
  formatMosaicName,
  layoutCourseMosaic,
  parseCourseMosaic,
  readCourseMosaicOptions,
  serializeCourseMosaic,
  sortCourseMosaic,
  splitCourseMosaicChain,
  type CourseMosaicCell,
  type CourseMosaicOptions,
  type CourseMosaicStudent,
} from "./course-mosaic";

const chicos = (n: number): CourseMosaicStudent[] =>
  Array.from({ length: n }, (_, i) => ({ firstName: `Nombre${i + 1}`, lastName: `Apellido${i + 1}` }));

const opciones = (patch: Partial<CourseMosaicOptions> = {}): CourseMosaicOptions => ({
  ...DEFAULT_COURSE_MOSAIC_OPTIONS,
  gapX: 10,
  gapY: 10,
  photoAspect: 0.75,
  namePosition: "below",
  ...patch,
});

const repartir = (n: number, w: number, h: number, patch: Partial<CourseMosaicOptions> = {}) =>
  layoutCourseMosaic({ students: chicos(n), options: opciones(patch), width: w, height: h, fontSize: 16, lineHeight: 1.2 });

/** El rectángulo que ocupa una celda entera: la foto más su nombre. */
function caja(c: CourseMosaicCell) {
  const x1 = Math.min(c.photo.x, c.name?.x ?? Infinity);
  const y1 = Math.min(c.photo.y, c.name?.y ?? Infinity);
  const x2 = Math.max(c.photo.x + c.photo.width, c.name ? c.name.x + c.name.width : -Infinity);
  const y2 = Math.max(c.photo.y + c.photo.height, c.name ? c.name.y + c.name.height : -Infinity);
  return { x1, y1, x2, y2 };
}

const EPS = 0.01;

test("el valor guardado se lee igual que se escribió", () => {
  const x: CourseMosaicStudent[] = [
    { firstName: "Ana", lastName: "Pérez", photoId: 7, crop: { zoom: 1.5, x: 0, y: -0.4 } },
    { firstName: "Juan", lastName: "Gómez", photoUrl: "https://r2.example/a.jpg", sourceAspect: 0.66 },
  ];
  assert.deepEqual(parseCourseMosaic(serializeCourseMosaic(x)), x);
});

test("un valor vacío o roto es un mosaico sin chicos", () => {
  assert.deepEqual(parseCourseMosaic(""), []);
  assert.deepEqual(parseCourseMosaic("{roto"), []);
  assert.deepEqual(parseCourseMosaic(null), []);
  assert.deepEqual(parseCourseMosaic(undefined), []);
});

test("se descartan los chicos sin nombre ni apellido", () => {
  const raw = JSON.stringify([{ firstName: "", lastName: "" }, { firstName: "Ana", lastName: "" }, 3, null]);
  assert.deepEqual(parseCourseMosaic(raw), [{ firstName: "Ana", lastName: "" }]);
});

test("sin opciones guardadas valen las de por defecto", () => {
  assert.deepEqual(readCourseMosaicOptions({}), DEFAULT_COURSE_MOSAIC_OPTIONS);
  assert.deepEqual(readCourseMosaicOptions(null), DEFAULT_COURSE_MOSAIC_OPTIONS);
});

test("las opciones fuera de rango se acotan", () => {
  const o = readCourseMosaicOptions({
    courseMosaic: { gapX: -5, photoAspect: 0, tilt: 30, chainOrder: 0, capacity: -1, frame: "hexagon" },
  });
  assert.equal(o.gapX, 0);
  assert.equal(o.photoAspect, 0.2);
  assert.equal(o.tilt, 10);
  assert.equal(o.chainOrder, 1);
  assert.equal(o.capacity, 0);
  assert.equal(o.frame, "rect");
  assert.equal(readCourseMosaicOptions({ courseMosaic: { photoAspect: 9 } }).photoAspect, 5);
});

test("25 chicos entran en el bloque, sin salirse ni pisarse, todos del mismo tamaño", () => {
  const { cells, overflow } = repartir(25, 1000, 800);
  assert.equal(cells.length, 25);
  assert.equal(overflow, 0);
  for (const c of cells) {
    const b = caja(c);
    assert.ok(b.x1 >= -EPS && b.y1 >= -EPS && b.x2 <= 1000 + EPS && b.y2 <= 800 + EPS, "se sale del bloque");
    assert.ok(Math.abs(c.photo.width - cells[0]!.photo.width) < EPS);
    assert.ok(Math.abs(c.photo.height - cells[0]!.photo.height) < EPS);
  }
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = caja(cells[i]!);
      const b = caja(cells[j]!);
      const pisa = a.x1 < b.x2 - EPS && b.x1 < a.x2 - EPS && a.y1 < b.y2 - EPS && b.y1 < a.y2 - EPS;
      assert.ok(!pisa, `la celda ${i} pisa a la ${j}`);
    }
  }
});

function columnasYFilas(cells: CourseMosaicCell[]) {
  const xs = new Set(cells.map((c) => Math.round(c.photo.x)));
  const ys = new Set(cells.map((c) => Math.round(c.photo.y)));
  return { cols: xs.size, rows: ys.size };
}

test("en un bloque apaisado hay más columnas que filas, y al revés en uno alto", () => {
  const ancho = columnasYFilas(repartir(25, 2000, 500).cells);
  assert.ok(ancho.cols > ancho.rows, JSON.stringify(ancho));
  const alto = columnasYFilas(repartir(25, 500, 2000).cells);
  assert.ok(alto.rows > alto.cols, JSON.stringify(alto));
});

test("con menos chicos las fotos salen más grandes", () => {
  const cinco = repartir(5, 1000, 800).cells[0]!.photo.width;
  const cuarenta = repartir(40, 1000, 800).cells[0]!.photo.width;
  assert.ok(cinco > cuarenta);
});

test("la última fila incompleta se centra", () => {
  // 7 chicos en un bloque que obliga a 3 columnas: la última fila tiene uno solo.
  const { cells } = repartir(7, 1000, 1300, { gapX: 10 });
  const { cols } = columnasYFilas(cells);
  assert.equal(cols, 3);
  const ultima = cells[6]!;
  const centro = ultima.photo.x + ultima.photo.width / 2;
  assert.ok(Math.abs(centro - 500) <= 1, `centro ${centro}`);
});

test("la zona libre queda sin celdas y entran igual todos", () => {
  const reserved = { x: 0.5, y: 0, width: 0.5, height: 0.5 };
  const { cells, overflow } = repartir(25, 1000, 800, { reserved });
  assert.equal(cells.length, 25);
  assert.equal(overflow, 0);
  const z = { x1: 500, y1: 0, x2: 1000, y2: 400 };
  for (const c of cells) {
    const b = caja(c);
    const corta = b.x1 < z.x2 - EPS && z.x1 < b.x2 - EPS && b.y1 < z.y2 - EPS && z.y1 < b.y2 - EPS;
    assert.ok(!corta, "una celda corta la zona libre");
  }
});

test("sin separación ni nombre las celdas vecinas se tocan", () => {
  const { cells } = repartir(12, 1200, 600, { gapX: 0, gapY: 0, namePosition: "none" });
  const a = cells[0]!;
  const b = cells[1]!;
  assert.ok(Math.abs(a.photo.y - b.photo.y) < EPS, "no están en la misma fila");
  assert.ok(Math.abs(a.photo.x + a.photo.width - b.photo.x) < EPS);
  assert.equal(a.name, null);
});

test("el giro alterna de lado y sin giro todas van derechas", () => {
  const giradas = repartir(4, 1000, 800, { tilt: 3 }).cells.map((c) => c.rotation);
  assert.deepEqual(giradas, [3, -3, 3, -3]);
  assert.ok(repartir(4, 1000, 800).cells.every((c) => c.rotation === 0));
});

test("los bloques encadenados se reparten los chicos en orden", () => {
  const bloques = [
    { id: "b", options: opciones({ chainOrder: 2, capacity: 0 }) },
    { id: "a", options: opciones({ chainOrder: 1, capacity: 10 }) },
  ];
  const lista = chicos(25);
  const r = splitCourseMosaicChain(bloques, lista);
  assert.deepEqual(r.get("a"), lista.slice(0, 10));
  assert.deepEqual(r.get("b"), lista.slice(10));
  const pocos = splitCourseMosaicChain(bloques, chicos(6));
  assert.equal(pocos.get("a")!.length, 6);
  assert.deepEqual(pocos.get("b"), []);
});

test("el nombre sale en una o dos líneas, con todos los nombres o sólo el primero", () => {
  const s = { firstName: "María Sol", lastName: "Pérez" };
  assert.deepEqual(formatMosaicName(s, opciones({ givenNames: "first", nameLines: 1 })), ["María Pérez"]);
  assert.deepEqual(formatMosaicName(s, opciones({ givenNames: "first", nameLines: 2 })), ["María", "Pérez"]);
  assert.deepEqual(formatMosaicName(s, opciones({ givenNames: "all", nameLines: 1 })), ["María Sol Pérez"]);
});

test("se ordena por apellido en castellano", () => {
  const lista = [
    { firstName: "A", lastName: "Ñandú" },
    { firstName: "B", lastName: "Nuñez" },
    { firstName: "C", lastName: "Oliva" },
  ];
  assert.deepEqual(
    sortCourseMosaic(lista, opciones({ sortBy: "lastName" })).map((s) => s.lastName),
    ["Nuñez", "Ñandú", "Oliva"],
  );
});

test("los nombres largos no se salen del ancho de su foto", () => {
  const largo = [{ firstName: "María de los Ángeles", lastName: "Fernández Etcheverry" }];
  const { cells } = layoutCourseMosaic({
    students: [...largo, ...chicos(29)],
    options: opciones(),
    width: 1000,
    height: 800,
    fontSize: 16,
    lineHeight: 1.2,
  });
  const c = cells[0]!;
  assert.ok(c.name);
  const anchoMedido = Math.max(...c.name.lines.map((l) => 0.55 * c.name!.fontSize * l.length));
  assert.ok(anchoMedido <= c.name.width + EPS, `mide ${anchoMedido} y hay ${c.name.width}`);
  assert.ok(c.name.fontSize >= 16 * 0.6 - EPS);
});

test("hay 24 compañeros de muestra", () => {
  assert.equal(COURSE_MOSAIC_SAMPLE.length, 24);
});

test("la cadena se ordena con las opciones de su primer bloque y reparte por bloque", () => {
  const bloques = [
    { id: "b", configJson: { variableKey: "course.mosaic", courseMosaic: { chainOrder: 2 } } },
    { id: "a", configJson: { variableKey: "course.mosaic", courseMosaic: { chainOrder: 1, capacity: 1, sortBy: "firstName" } } },
  ];
  const lista = [
    { firstName: "Zoe", lastName: "Alba" },
    { firstName: "Ana", lastName: "Zapata" },
  ];
  const r = distributeCourseMosaic(bloques, lista);
  assert.deepEqual(r.get("a")!.map((s) => s.firstName), ["Ana"]);
  assert.deepEqual(r.get("b")!.map((s) => s.firstName), ["Zoe"]);
});

test("dos mosaicos con el mismo orden son copias: cada uno lleva a todos", () => {
  const bloques = [
    { id: "a", options: opciones({ chainOrder: 1 }) },
    { id: "b", options: opciones({ chainOrder: 1 }) },
  ];
  const lista = chicos(5);
  const r = splitCourseMosaicChain(bloques, lista);
  assert.deepEqual(r.get("a"), lista);
  assert.deepEqual(r.get("b"), lista);
});

test("en círculo el retrato es cuadrado aunque la proporción guardada sea 3:4", () => {
  const { cells } = repartir(10, 1000, 800, { frame: "circle", photoAspect: 0.75 });
  for (const c of cells) assert.ok(Math.abs(c.photo.width - c.photo.height) < EPS);
});

test("un bloque muy apaisado usa más de 14 columnas si hace falta", () => {
  const { cells } = repartir(40, 3000, 400);
  assert.equal(cells.length, 40);
  assert.ok(cells[0]!.photo.width > 90, `foto de ${cells[0]!.photo.width}`);
});

test("el ejemplo del catálogo escolar trae compañeros para el mosaico", async () => {
  const { SCHOOL_TEMPLATE_EXAMPLE_DATA } = await import("./index");
  assert.equal(parseCourseMosaic(String(SCHOOL_TEMPLATE_EXAMPLE_DATA["course.mosaic"])).length, COURSE_MOSAIC_SAMPLE.length);
});

test("un eslabón sin tope que no es el último se reparte parejo con los que siguen", () => {
  const bloques = [
    { id: "izq", options: opciones({ chainOrder: 1, capacity: 0 }) },
    { id: "der", options: opciones({ chainOrder: 2, capacity: 0 }) },
  ];
  const r = splitCourseMosaicChain(bloques, chicos(25));
  assert.equal(r.get("izq")!.length, 13);
  assert.equal(r.get("der")!.length, 12);
  const tres = splitCourseMosaicChain([...bloques, { id: "c", options: opciones({ chainOrder: 3 }) }], chicos(10));
  assert.deepEqual(["izq", "der", "c"].map((k) => tres.get(k)!.length), [4, 3, 3]);
});
