import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COURSE_MOSAIC_SAMPLE,
  DEFAULT_COURSE_MOSAIC_OPTIONS,
  isCourseMosaicConfig,
  readCourseMosaicOptions,
  type CourseMosaicOptions,
  type CourseMosaicStudent,
} from "@repo/template-engine";
import { createDefaultCourseMosaicBlock } from "../create-default-blocks";
import { editorADocumento, type EditorBlock } from "../design-studio-bridge";
import { normalizeBlockConfig } from "../render-core";

/**
 * El mosaico del curso llega al papel: cada compañero sale como bloques comunes (sombra, papel,
 * foto, borde, marco, cinta, nombre) con la misma cuenta de reparto que el lienzo.
 */

function mosaico(id: string, opciones: Partial<CourseMosaicOptions> = {}, extra: Partial<EditorBlock> = {}): EditorBlock {
  return {
    id,
    type: "VARIABLE_TEXT",
    name: "Mosaico",
    pageIndex: 0,
    x: 100,
    y: 100,
    width: 1500,
    height: 1000,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    locked: false,
    visible: true,
    configJson: {
      variableKey: "course.mosaic",
      fontFamily: "Inter",
      fontSize: 30,
      courseMosaic: { ...DEFAULT_COURSE_MOSAIC_OPTIONS, ...opciones },
    },
    ...extra,
  };
}

type Dibujable = Record<string, unknown>;

function dibujar(blocks: EditorBlock[], mosaicoDelCurso?: CourseMosaicStudent[]) {
  const r = editorADocumento({ canvas: { width: 3600, height: 2400, dpi: 300 }, blocks, mosaicoDelCurso });
  const sides = (r.document as { sides: { blocks: Dibujable[] }[] }).sides;
  return { todos: sides.flatMap((s) => s.blocks), avisos: r.avisos };
}

const partes = (todos: Dibujable[], bloque: string, parte: string) =>
  todos.filter((b) => new RegExp(`^${bloque}__m\\d+_${parte}$`).test(String(b.id)));

const tres: CourseMosaicStudent[] = [
  { firstName: "Ana", lastName: "Gómez", photoId: 7, crop: { zoom: 1.4, x: 0, y: -0.3 }, sourceAspect: 0.66 },
  { firstName: "Bruno", lastName: "Díaz", photoUrl: "https://r2.example/bruno.jpg" },
  { firstName: "Juan", lastName: "Pérez" },
];

describe("editorADocumento — mosaico del curso", () => {
  it("la foto real va por referencia, la de pantalla por dirección y sin foto sale una silueta", () => {
    const { todos } = dibujar([mosaico("mos")], tres);
    const fotos = partes(todos, "mos", "foto");
    assert.equal(fotos.length, 2);
    // Van por apellido: Díaz, Gómez, Pérez.
    assert.equal(fotos[0]!.type, "image");
    assert.equal(fotos[0]!.resourceRef, "https://r2.example/bruno.jpg");
    assert.equal(fotos[1]!.resourceRef, "mosaic-photo:7");
    assert.deepEqual(fotos[1]!.crop, { zoom: 1.4, x: 0, y: -0.3 });
    assert.equal(fotos[1]!.sourceAspect, 0.66);
    const silueta = partes(todos, "mos", "silueta");
    assert.equal(silueta.length, 1);
    assert.equal(silueta[0]!.type, "rect");
    assert.equal(silueta[0]!.fillColor, "#d6d3d1");
    const iniciales = partes(todos, "mos", "iniciales");
    assert.equal(iniciales[0]!.content, "JP");
    assert.deepEqual(
      partes(todos, "mos", "nombre").map((n) => n.content),
      ["Bruno\nDíaz", "Ana\nGómez", "Juan\nPérez"],
    );
  });

  it("en círculo la foto va recortada en círculo y el borde redondo", () => {
    const { todos } = dibujar([mosaico("mos", { frame: "circle", borderWidth: 6, borderColor: "#ff0000" })], tres);
    const foto = partes(todos, "mos", "foto")[0]!;
    assert.equal(foto.mask, "circle");
    const borde = partes(todos, "mos", "borde")[0]!;
    assert.equal(borde.type, "rect");
    assert.equal(borde.fillColor, undefined);
    assert.equal(borde.strokeColor, "#ff0000");
    assert.ok(Math.abs(Number(borde.cornerRadius) - Number(borde.width) / 2) < 1e-6);
  });

  it("una elipse con borde avisa y no dibuja el borde", () => {
    const { todos, avisos } = dibujar([mosaico("mos", { frame: "ellipse", borderWidth: 4 })], tres);
    assert.equal(partes(todos, "mos", "borde").length, 0);
    assert.ok(avisos.some((a) => a.includes("borde de elipse")));
  });

  it("dos bloques encadenados se reparten los chicos", () => {
    const cinco = COURSE_MOSAIC_SAMPLE.slice(0, 5);
    const { todos } = dibujar(
      [
        mosaico("b", { chainOrder: 2, capacity: 0 }, { pageIndex: 1 }),
        mosaico("a", { chainOrder: 1, capacity: 2 }),
      ],
      cinco,
    );
    assert.equal(partes(todos, "a", "nombre").length, 2);
    assert.equal(partes(todos, "b", "nombre").length, 3);
  });

  it("girado, cada parte gira alrededor del centro del bloque", () => {
    const derecho = dibujar([mosaico("mos")], tres).todos;
    const girado = dibujar([mosaico("mos", {}, { rotation: 90 })], tres).todos;
    const pxAmm = 25.4 / 300;
    const cx = (100 + 1500 / 2) * pxAmm;
    const cy = (100 + 1000 / 2) * pxAmm;
    const d = partes(derecho, "mos", "foto")[1]!;
    const g = partes(girado, "mos", "foto")[1]!;
    const dx = Number(d.x) + Number(d.width) / 2 - cx;
    const dy = Number(d.y) + Number(d.height) / 2 - cy;
    assert.ok(Math.abs(Number(g.x) + Number(g.width) / 2 - (cx - dy)) < 1e-6);
    assert.ok(Math.abs(Number(g.y) + Number(g.height) / 2 - (cy + dx)) < 1e-6);
    assert.equal(g.rotation, 90);
  });

  it("sin chicos dados dibuja los compañeros de muestra; con lista vacía no dibuja nada", () => {
    assert.equal(partes(dibujar([mosaico("mos")]).todos, "mos", "nombre").length, COURSE_MOSAIC_SAMPLE.length);
    assert.equal(dibujar([mosaico("mos")], []).todos.length, 0);
  });

  it("la sombra va debajo de la foto, corrida y del color elegido", () => {
    const { todos } = dibujar([mosaico("mos", { shadow: { dx: 20, dy: 20, color: "#f5c518" } })], tres);
    const ids = todos.map((b) => String(b.id));
    const sombra = partes(todos, "mos", "sombra")[0]!;
    const foto = partes(todos, "mos", "foto")[0]!;
    assert.equal(sombra.fillColor, "#f5c518");
    assert.ok(ids.indexOf(String(sombra.id)) < ids.indexOf(String(foto.id)));
    assert.ok(Math.abs(Number(sombra.x) - Number(foto.x) - (20 * 25.4) / 300) < 1e-6);
  });

  it("el bloque por defecto es un mosaico con las opciones de fábrica", () => {
    const b = createDefaultCourseMosaicBlock({ width: 3600, height: 2400 } as Parameters<typeof createDefaultCourseMosaicBlock>[0], []);
    assert.ok(isCourseMosaicConfig(b.configJson));
    assert.deepEqual(readCourseMosaicOptions(b.configJson), DEFAULT_COURSE_MOSAIC_OPTIONS);
    assert.equal(b.type, "VARIABLE_TEXT");
    assert.equal(b.name, "Mosaico del curso");
  });
});

describe("normalizeBlockConfig — mosaico del curso", () => {
  it("conserva las opciones del mosaico al normalizar el bloque", () => {
    const cfg = { variableKey: "course.mosaic", courseMosaic: { frame: "polaroid", tilt: 3 } };
    const n = normalizeBlockConfig("VARIABLE_TEXT", cfg) as Record<string, unknown>;
    assert.deepEqual(n.courseMosaic, { frame: "polaroid", tilt: 3 });
  });
});
