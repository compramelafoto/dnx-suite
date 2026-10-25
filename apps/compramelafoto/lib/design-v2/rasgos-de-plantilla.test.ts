import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FILTROS_VACIOS,
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
    filtrarPlantillas(items, { ...FILTROS_VACIOS, estilo: "divertido", logo: "si" }).map((i) => i.name),
    ["Librito Primaria · Pizarrón"],
  );
  assert.deepEqual(
    filtrarPlantillas(items, { ...FILTROS_VACIOS, listado: "no" }).map((i) => i.name),
    ["Estampita"],
  );
  assert.deepEqual(
    filtrarPlantillas(items, { ...FILTROS_VACIOS, orientacion: "horizontal", cantidadFotos: "1", evento: "Primera Comunión" }).map(
      (i) => i.name,
    ),
    ["Estampita"],
  );
  assert.equal(filtrarPlantillas(items, { ...FILTROS_VACIOS, categoria: "Jardin" }).length, 1, "sin tilde también");
  assert.equal(filtrarPlantillas(items, { ...FILTROS_VACIOS, categoria: "Secundaria" }).length, 0);
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
  assert.equal(hayFiltros({ ...FILTROS_VACIOS, logo: "no" }), true);
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
  assert.deepEqual(filtrarPlantillas(items, { ...FILTROS_VACIOS, mosaico: "si" }).map((i) => i.name), ["con"]);
  assert.deepEqual(filtrarPlantillas(items, { ...FILTROS_VACIOS, mosaico: "no" }).map((i) => i.name), ["sin"]);
});
