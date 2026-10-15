import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ARCHIVOS_DEMO,
  FOTO_DE_MUESTRA_DATA_URL,
  categoriaDeMeta,
  demoDePlantilla,
  fotosDeDemoPorHueco,
  logoDemoDeCategoria,
  nivelDemoDeCategoria,
  selloDeDemo,
  urlDeDemo,
  varianteDemo,
} from "./demo-de-plantilla";
import { valoresDeDemo } from "./demo-valores";

test("los archivos esperados son exactamente los 14 acordados", () => {
  assert.deepEqual([...ARCHIVOS_DEMO].sort(), [
    "grupal-egresados.jpg",
    "grupal-jardin.jpg",
    "grupal-primaria.jpg",
    "grupal-secundaria.jpg",
    "logo-escudo-clasico.png",
    "logo-moderno.png",
    "retrato-egresados-1.jpg",
    "retrato-egresados-2.jpg",
    "retrato-jardin-1.jpg",
    "retrato-jardin-2.jpg",
    "retrato-primaria-1.jpg",
    "retrato-primaria-2.jpg",
    "retrato-secundaria-1.jpg",
    "retrato-secundaria-2.jpg",
  ]);
});

test("cada categoría del catálogo usa las fotos de su nivel", () => {
  assert.equal(nivelDemoDeCategoria("Jardín"), "jardin");
  assert.equal(nivelDemoDeCategoria("jardin"), "jardin");
  assert.equal(nivelDemoDeCategoria("Primaria"), "primaria");
  assert.equal(nivelDemoDeCategoria("Secundaria"), "secundaria");
  assert.equal(nivelDemoDeCategoria("Egresados"), "egresados");
  // Las que no son un nivel: lo formal con secundaria, lo demás con primaria.
  assert.equal(nivelDemoDeCategoria("Formal"), "secundaria");
  assert.equal(nivelDemoDeCategoria("Informal"), "primaria");
  assert.equal(nivelDemoDeCategoria("Minimalista"), "primaria");
  assert.equal(nivelDemoDeCategoria(null), "primaria");
});

test("el logo de muestra acompaña el estilo", () => {
  assert.equal(logoDemoDeCategoria("Jardín"), "logo-moderno.png");
  assert.equal(logoDemoDeCategoria("Primaria"), "logo-escudo-clasico.png");
  assert.equal(logoDemoDeCategoria("Formal"), "logo-escudo-clasico.png");
  assert.equal(logoDemoDeCategoria("Informal"), "logo-moderno.png");
  assert.equal(logoDemoDeCategoria("Egresados"), "logo-escudo-clasico.png");
});

test("la categoría sale del meta de la versión", () => {
  assert.equal(categoriaDeMeta({ categoria: " Jardín " }), "Jardín");
  assert.equal(categoriaDeMeta({}), null);
  assert.equal(categoriaDeMeta(null), null);
  assert.equal(categoriaDeMeta([1]), null);
});

test("nena o nene: fijo por plantilla, y el nombre coincide con la foto", () => {
  assert.equal(varianteDemo("abc"), varianteDemo("abc"));
  const variantes = new Set(["a", "b", "c", "d", "e", "f"].map(varianteDemo));
  assert.deepEqual([...variantes].sort(), [1, 2]);

  const ids = ["plantilla-a", "plantilla-b", "plantilla-c", "plantilla-d"];
  for (const templateId of ids) {
    const demo = demoDePlantilla({ templateId, meta: { categoria: "Primaria" } });
    assert.equal(demo.archivos.retrato, `retrato-primaria-${demo.variante}.jpg`);
    assert.equal(demo.archivos.grupal, "grupal-primaria.jpg");
    // 1 = nena (Valentina), 2 = nene (Mateo).
    assert.equal(demo.alumno.firstName, demo.variante === 1 ? "Valentina" : "Mateo");
  }
});

test("el alumno aparece una vez y marcado en el listado del curso, ordenado por apellido", () => {
  const demo = demoDePlantilla({ templateId: "x", meta: { categoria: "Secundaria" } });
  const propios = demo.companeros.filter((c) => c.isOwner);
  assert.equal(propios.length, 1);
  assert.equal(propios[0]!.lastName, demo.alumno.lastName);
  const apellidos = demo.companeros.map((c) => c.lastName);
  assert.deepEqual(apellidos, [...apellidos].sort((a, b) => a.localeCompare(b, "es")));
  assert.ok(demo.companeros.length >= 10);
});

test("los valores de demo llenan nombre, curso, colegio, listado y logo", () => {
  const demo = demoDePlantilla({ templateId: "x", meta: { categoria: "Jardín" } });
  const v = valoresDeDemo(demo, "https://r2.example/template-v2/demo/logo-moderno.png");
  assert.equal(v["student.fullName"], `${demo.alumno.firstName} ${demo.alumno.lastName}`);
  assert.equal(v["course.displayName"], "Sala de 5 Celeste");
  assert.equal(v["school.name"], "Jardín Arco Iris");
  assert.equal(v["course.withSchool"], "Sala de 5 Celeste - Jardín Arco Iris");
  assert.equal(v["branding.schoolLogoUrl"], "https://r2.example/template-v2/demo/logo-moderno.png");
  assert.ok(v["course.studentList"]?.includes(demo.alumno.lastName));
  // Sin logo subido, no se manda: el bloque del logo no se muestra.
  assert.equal(valoresDeDemo(demo, null)["branding.schoolLogoUrl"], undefined);
});

test("la dirección pública de la demo", () => {
  assert.equal(
    urlDeDemo("https://pub.r2.dev/", "grupal-jardin.jpg"),
    "https://pub.r2.dev/template-v2/demo/grupal-jardin.jpg",
  );
  assert.equal(urlDeDemo("", "grupal-jardin.jpg"), null);
  assert.equal(urlDeDemo(undefined, "grupal-jardin.jpg"), null);
});

test("cada hueco recibe su foto, y la de muestra si la de demo no está", () => {
  const slots = [
    { blockId: "ind", role: "individual" as const },
    { blockId: "grp", role: "group" as const },
    { blockId: "otro", role: null },
  ];
  assert.deepEqual(fotosDeDemoPorHueco(slots, { retrato: "R", grupal: "G" }), {
    ind: { src: "R" },
    grp: { src: "G" },
    otro: { src: "R" },
  });
  const sinFotos = fotosDeDemoPorHueco(slots, { retrato: null, grupal: null });
  assert.equal(sinFotos.ind!.src, FOTO_DE_MUESTRA_DATA_URL);
  assert.equal(sinFotos.grp!.src, FOTO_DE_MUESTRA_DATA_URL);
  assert.ok(FOTO_DE_MUESTRA_DATA_URL.startsWith("data:image/svg+xml"));
});

test("el sello de la miniatura cambia cuando se suben las fotos", () => {
  assert.equal(selloDeDemo({ retrato: false, grupal: false, logo: false }), "r0g0l0");
  assert.equal(selloDeDemo({ retrato: true, grupal: true, logo: true }), "r1g1l1");
  assert.notEqual(
    selloDeDemo({ retrato: true, grupal: false, logo: true }),
    selloDeDemo({ retrato: true, grupal: true, logo: true }),
  );
});
