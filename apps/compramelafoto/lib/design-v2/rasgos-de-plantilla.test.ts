import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FILTROS_VACIOS,
  alternarOpcion,
  cantidadDeFiltros,
  filtrarPlantillas,
  hayFiltros,
  opcionesDeFiltros,
  rasgosDePlantilla,
  type RasgosDePlantilla,
} from "./rasgos-de-plantilla";

const img = (variableKey: string) => ({ type: "IMAGE", configJson: { source: { variableKey } } });
const txt = (variableKey: string) => ({ type: "VARIABLE_TEXT", configJson: { variableKey } });

test("sin metadatos se deduce de los bloques: listado, logo, fotos y vertical", () => {
  const r = rasgosDePlantilla({
    meta: { system: true, categoria: "Primaria" },
    blocks: [
      img("photo_individual"),
      img("photo_individual"), // la misma foto en otra cara no suma
      img("photo_group"),
      img("photo_teacher"),
      img("branding.schoolLogoUrl"),
      txt("course.studentList"),
      txt("student.fullName"),
      { type: "TEXT", configJson: {} },
    ],
  });
  assert.deepEqual(r, {
    tipoProducto: null,
    categoria: "Primaria",
    estilo: null,
    orientacion: "vertical",
    cantidadFotos: 3,
    conListado: true,
    conMosaico: false,
    conLogo: true,
    evento: null,
    etiquetas: [],
  });
});

test("sin listado ni logo; photoInputs cuenta si dice más que los bloques", () => {
  const r = rasgosDePlantilla({
    meta: { photoInputs: [{ slotKey: "photo_1" }, { slotKey: "photo_2" }] },
    blocks: [img("photo_1"), txt("student.fullName")],
  });
  assert.equal(r.cantidadFotos, 2);
  assert.equal(r.conListado, false);
  assert.equal(r.conLogo, false);
});

test("el logo atado por vínculo también cuenta", () => {
  const r = rasgosDePlantilla({ meta: {}, blocks: [], bindingKeys: ["branding.schoolLogoUrl"] });
  assert.equal(r.conLogo, true);
});

test("los metadatos mandan sobre lo deducido", () => {
  const r = rasgosDePlantilla({
    meta: {
      categoria: "Religioso",
      estilo: "Clásico",
      orientacion: "horizontal",
      cantidadFotos: 4,
      conListado: false,
      conMosaico: false,
      conLogo: false,
      evento: "Primera Comunión",
      etiquetas: ["cruz", " dorado ", 3],
    },
    blocks: [txt("course.studentList"), img("branding.schoolLogoUrl"), img("photo_individual")],
  });
  assert.equal(r.orientacion, "horizontal");
  assert.equal(r.cantidadFotos, 4);
  assert.equal(r.conListado, false);
  assert.equal(r.conLogo, false);
  assert.equal(r.evento, "Primera Comunión");
  assert.deepEqual(r.etiquetas, ["cruz", "dorado"]);
});

const base: RasgosDePlantilla = {
  tipoProducto: "Librito",
  categoria: null,
  estilo: null,
  orientacion: "vertical",
  cantidadFotos: 2,
  conListado: true,
  conMosaico: false,
  conLogo: false,
  evento: null,
  etiquetas: [],
};
const items = [
  { name: "Librito Jardín · Acuarelas", rasgos: { ...base, categoria: "Jardín", estilo: "Divertido", etiquetas: ["acuarela"] } },
  { name: "Librito Primaria · Pizarrón", rasgos: { ...base, categoria: "Primaria", estilo: "Divertido", conLogo: true } },
  {
    name: "Estampita",
    rasgos: { ...base, categoria: "Religioso", evento: "Primera Comunión", orientacion: "horizontal" as const, cantidadFotos: 1, conListado: false },
  },
  { name: "Egresados dorado", rasgos: { ...base, categoria: "Egresados", estilo: "Formal", conLogo: true } },
];

test("los filtros se combinan", () => {
  assert.equal(filtrarPlantillas(items, FILTROS_VACIOS).length, 4);
  assert.deepEqual(
    filtrarPlantillas(items, { ...FILTROS_VACIOS, estilo: ["divertido"], logo: ["si"] }).map((i) => i.name),
    ["Librito Primaria · Pizarrón"],
  );
  assert.deepEqual(
    filtrarPlantillas(items, { ...FILTROS_VACIOS, listado: ["no"] }).map((i) => i.name),
    ["Estampita"],
  );
  assert.deepEqual(
    filtrarPlantillas(items, { ...FILTROS_VACIOS, orientacion: ["horizontal"], cantidadFotos: ["1"], evento: ["Primera Comunión"] }).map(
      (i) => i.name,
    ),
    ["Estampita"],
  );
  assert.equal(filtrarPlantillas(items, { ...FILTROS_VACIOS, categoria: ["Jardin"] }).length, 1, "sin tilde también");
  assert.equal(filtrarPlantillas(items, { ...FILTROS_VACIOS, categoria: ["Secundaria"] }).length, 0);
});

test("el buscador mira nombre y etiquetas, sin importar tildes ni mayúsculas", () => {
  assert.deepEqual(filtrarPlantillas(items, { ...FILTROS_VACIOS, texto: "ACUARELA" }).map((i) => i.name), [
    "Librito Jardín · Acuarelas",
  ]);
  assert.deepEqual(filtrarPlantillas(items, { ...FILTROS_VACIOS, texto: "pizarron librito" }).map((i) => i.name), [
    "Librito Primaria · Pizarrón",
  ]);
  assert.deepEqual(filtrarPlantillas(items, { ...FILTROS_VACIOS, texto: "comunion" }).map((i) => i.name), ["Estampita"]);
});

test("las opciones salen de lo que hay, con los niveles en orden escolar", () => {
  const op = opcionesDeFiltros(items);
  assert.deepEqual(op.categorias, ["Jardín", "Primaria", "Egresados", "Religioso"]);
  assert.deepEqual(op.eventos, ["Primera Comunión"]);
  assert.deepEqual(op.estilos, ["Divertido", "Formal"]);
  assert.deepEqual(op.orientaciones, ["horizontal", "vertical"]);
  assert.deepEqual(op.cantidades, [1, 2]);
  assert.equal(hayFiltros(FILTROS_VACIOS), false);
  assert.equal(hayFiltros({ ...FILTROS_VACIOS, logo: ["no"] }), true);
});

test("una plantilla con mosaico del curso tiene el rasgo y se filtra", () => {
  const conMosaico = rasgosDePlantilla({
    meta: {},
    blocks: [{ type: "VARIABLE_TEXT", configJson: { variableKey: "course.mosaic" } }],
  });
  const sinMosaico = rasgosDePlantilla({ meta: {}, blocks: [] });
  assert.equal(conMosaico.conMosaico, true);
  assert.equal(sinMosaico.conMosaico, false);
  const items = [
    { name: "con", rasgos: conMosaico },
    { name: "sin", rasgos: sinMosaico },
  ];
  assert.deepEqual(filtrarPlantillas(items, { ...FILTROS_VACIOS, mosaico: ["si"] }).map((i) => i.name), ["con"]);
  assert.deepEqual(filtrarPlantillas(items, { ...FILTROS_VACIOS, mosaico: ["no"] }).map((i) => i.name), ["sin"]);
});

test("varias opciones tildadas en un filtro suman; entre filtros, se cumplen todos", () => {
  const varias = [
    ...items,
    { name: "Diploma jardín", rasgos: { ...base, tipoProducto: "Diploma", categoria: "Jardín", cantidadFotos: 1, conListado: false } },
    { name: "Diploma egresados", rasgos: { ...base, tipoProducto: "Diploma", categoria: "Egresados", cantidadFotos: 1, conListado: false } },
    { name: "Calendario 2027", rasgos: { ...base, tipoProducto: "Calendario", categoria: "Primaria", cantidadFotos: 1, conListado: false } },
  ];
  const nombres = (f: typeof FILTROS_VACIOS) => filtrarPlantillas(varias, f).map((i) => i.name);
  assert.deepEqual(nombres({ ...FILTROS_VACIOS, categoria: ["Jardín", "Primaria"] }), [
    "Librito Jardín · Acuarelas",
    "Librito Primaria · Pizarrón",
    "Diploma jardín",
    "Calendario 2027",
  ]);
  assert.deepEqual(nombres({ ...FILTROS_VACIOS, tipoProducto: ["Diploma", "Calendario"] }), [
    "Diploma jardín",
    "Diploma egresados",
    "Calendario 2027",
  ]);
  assert.deepEqual(nombres({ ...FILTROS_VACIOS, tipoProducto: ["Diploma"], categoria: ["Jardín", "Primaria"] }), ["Diploma jardín"]);
  // «Con» y «Sin» tildados a la vez es lo mismo que no filtrar.
  assert.equal(nombres({ ...FILTROS_VACIOS, logo: ["si", "no"] }).length, varias.length);
  assert.deepEqual(nombres({ ...FILTROS_VACIOS, cantidadFotos: ["1", "3"], tipoProducto: ["Librito"] }), ["Estampita"]);
});

test("tildar y destildar una opción", () => {
  const uno = alternarOpcion(FILTROS_VACIOS, "tipoProducto", "Diploma");
  const dos = alternarOpcion(uno, "tipoProducto", "Calendario");
  assert.deepEqual(dos.tipoProducto, ["Diploma", "Calendario"]);
  assert.equal(cantidadDeFiltros(dos), 2);
  assert.deepEqual(alternarOpcion(dos, "tipoProducto", "Diploma").tipoProducto, ["Calendario"]);
  assert.deepEqual(FILTROS_VACIOS.tipoProducto, [], "no toca los filtros vacíos");
  assert.equal(hayFiltros({ ...FILTROS_VACIOS, texto: "flores" }), true);
});

test("el tipo de producto: el de los metadatos, o librito y álbum de figuritas por el doblez", () => {
  assert.equal(rasgosDePlantilla({ meta: { tipoProducto: "Diploma" }, blocks: [] }).tipoProducto, "Diploma");
  const librito = { system: true, foldGuideMmFromLeft: 150, pageLabels: ["Exterior (contratapa + tapa)", "Interior"] };
  assert.equal(rasgosDePlantilla({ meta: librito, blocks: [] }).tipoProducto, "Librito");
  assert.equal(
    rasgosDePlantilla({
      meta: { ...librito, pageLabels: [...librito.pageLabels, "Plancha de figuritas (papel autoadhesivo)"] },
      blocks: [],
    }).tipoProducto,
    "Álbum de figuritas",
  );
  // Una plantilla de un fotógrafo, sin datos: no se adivina.
  assert.equal(rasgosDePlantilla({ meta: { foldGuideMmFromLeft: 150 }, blocks: [] }).tipoProducto, null);
  const op = opcionesDeFiltros([
    { rasgos: { ...base, tipoProducto: "Calendario" } },
    { rasgos: { ...base, tipoProducto: "Diploma" } },
    { rasgos: { ...base, tipoProducto: "Librito" } },
  ]);
  assert.deepEqual(op.tipos, ["Librito", "Diploma", "Calendario"]);
});
