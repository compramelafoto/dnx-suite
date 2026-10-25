import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ARCHIVOS_DEMO,
  RETRATOS_DE_COMPANEROS,
  mosaicoDeDemo,
  FOTO_DE_MUESTRA_DATA_URL,
  archivosNecesarios,
  categoriaDeMeta,
  demoDePlantilla,
  eventoDemo,
  fotosDeDemoPorBloque,
  huecosDeDemo,
  logoDemoDeCategoria,
  nivelDemoDeCategoria,
  ranuraDeVariable,
  selloDeDemo,
  urlDeDemo,
  varianteDemo,
} from "./demo-de-plantilla";
import { valoresDeDemo } from "./demo-valores";

test("los archivos esperados son exactamente los acordados", () => {
  assert.deepEqual([...ARCHIVOS_DEMO].sort(), [
    "amigos-egresados.jpg",
    "amigos-primaria.jpg",
    "amigos-secundaria.jpg",
    "comunion-con-catequista.jpg",
    "comunion-detalle.jpg",
    "comunion-grupal.jpg",
    "comunion-momento.jpg",
    "comunion-retrato-1.jpg",
    "comunion-retrato-2.jpg",
    "con-maestra-jardin.jpg",
    "con-maestra-primaria.jpg",
    "confirmacion-grupal.jpg",
    "confirmacion-retrato.jpg",
    "grupal-egresados.jpg",
    "grupal-jardin.jpg",
    "grupal-primaria.jpg",
    "grupal-secundaria.jpg",
    "libre-patio.jpg",
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

test("cada variable de imagen tiene su ranura", () => {
  assert.equal(ranuraDeVariable("photo_individual"), "individual");
  assert.equal(ranuraDeVariable("photo_group"), "grupal");
  assert.equal(ranuraDeVariable("photo_teacher"), "maestra");
  assert.equal(ranuraDeVariable("photo_friends"), "amigos");
  assert.equal(ranuraDeVariable("photo_extra"), "extra");
  assert.equal(ranuraDeVariable("photo_3"), "individual");
  assert.equal(ranuraDeVariable("branding.schoolLogoUrl"), null);
  assert.equal(ranuraDeVariable(null), null);
});

test("nena o nene: fijo por plantilla, y el nombre coincide con la foto", () => {
  assert.equal(varianteDemo("abc"), varianteDemo("abc"));
  const variantes = new Set(["a", "b", "c", "d", "e", "f"].map(varianteDemo));
  assert.deepEqual([...variantes].sort(), [1, 2]);

  for (const templateId of ["plantilla-a", "plantilla-b", "plantilla-c", "plantilla-d"]) {
    const demo = demoDePlantilla({ templateId, meta: { categoria: "Primaria" } });
    assert.equal(demo.archivos.individual, `retrato-primaria-${demo.variante}.jpg`);
    assert.equal(demo.archivos.grupal, "grupal-primaria.jpg");
    // 1 = nena (Valentina), 2 = nene (Mateo).
    assert.equal(demo.alumno.firstName, demo.variante === 1 ? "Valentina" : "Mateo");
  }
});

test("maestra, amigos y libre según el nivel", () => {
  const jardin = demoDePlantilla({ templateId: "x", meta: { categoria: "Jardín" } });
  assert.equal(jardin.archivos.maestra, "con-maestra-jardin.jpg");
  assert.equal(jardin.archivos.amigos, "amigos-primaria.jpg");
  assert.equal(jardin.archivos.extra, "libre-patio.jpg");
  const primaria = demoDePlantilla({ templateId: "x", meta: { categoria: "Primaria" } });
  assert.equal(primaria.archivos.maestra, "con-maestra-primaria.jpg");
  assert.equal(primaria.archivos.amigos, "amigos-primaria.jpg");
  const secundaria = demoDePlantilla({ templateId: "x", meta: { categoria: "Secundaria" } });
  assert.equal(secundaria.archivos.amigos, "amigos-secundaria.jpg");
  const egresados = demoDePlantilla({ templateId: "x", meta: { categoria: "Egresados" } });
  assert.equal(egresados.archivos.amigos, "amigos-egresados.jpg");
  // Todos los archivos que puede pedir una plantilla están en la lista acordada.
  for (const d of [jardin, primaria, secundaria, egresados]) {
    for (const a of Object.values(d.archivos)) assert.ok(ARCHIVOS_DEMO.includes(a), a);
  }
});

test("religiosas: el evento elige las fotos", () => {
  assert.equal(eventoDemo("Religioso", "Primera Comunión"), "comunion");
  assert.equal(eventoDemo("Religioso", "Confirmación"), "confirmacion");
  assert.equal(eventoDemo("Religioso", null), "comunion");
  assert.equal(eventoDemo("Primaria", "Fin de año"), null);

  for (const templateId of ["a", "b"]) {
    const c = demoDePlantilla({ templateId, meta: { categoria: "Religioso", evento: "Primera Comunión" } });
    assert.equal(c.archivos.individual, `comunion-retrato-${c.variante}.jpg`);
    assert.equal(c.archivos.grupal, "comunion-grupal.jpg");
    assert.equal(c.archivos.maestra, "comunion-con-catequista.jpg");
    // Foto libre: con nena, la nena con la vela en la misa; con nene, el detalle de las manos.
    assert.equal(c.archivos.extra, c.variante === 1 ? "comunion-momento.jpg" : "comunion-detalle.jpg");
    for (const a of Object.values(c.archivos)) assert.ok(ARCHIVOS_DEMO.includes(a), a);
    assert.equal(c.curso, "Primera Comunión 2026");
  }
  const variantes = new Set(["a", "b", "c", "d", "e", "f"].map((templateId) => demoDePlantilla({ templateId, meta: { categoria: "Religioso", evento: "Primera Comunión" } }).archivos.extra));
  assert.deepEqual([...variantes].sort(), ["comunion-detalle.jpg", "comunion-momento.jpg"]);
  const conf = demoDePlantilla({ templateId: "a", meta: { categoria: "Religioso", evento: "Confirmación" } });
  assert.equal(conf.archivos.individual, "confirmacion-retrato.jpg");
  assert.equal(conf.archivos.grupal, "confirmacion-grupal.jpg");
  assert.equal(conf.archivos.extra, "libre-patio.jpg");
  for (const a of Object.values(conf.archivos)) assert.ok(ARCHIVOS_DEMO.includes(a), a);
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
  assert.equal(urlDeDemo("https://pub.r2.dev/", "grupal-jardin.jpg"), "https://pub.r2.dev/template-v2/demo/grupal-jardin.jpg");
  assert.equal(urlDeDemo("", "grupal-jardin.jpg"), null);
  assert.equal(urlDeDemo(undefined, "grupal-jardin.jpg"), null);
});

const img = (id: string, variableKey: string) => ({ id, type: "IMAGE", configJson: { source: { variableKey } } });

test("cada hueco recibe su foto, y la de muestra si la de demo no está", () => {
  const blocks = [
    img("ind", "photo_individual"),
    img("grp", "photo_group"),
    img("mae", "photo_teacher"),
    img("ami", "photo_friends"),
    img("lib", "photo_extra"),
    img("logo", "branding.schoolLogoUrl"),
    { id: "txt", type: "VARIABLE_TEXT", configJson: { variableKey: "student.fullName" } },
  ];
  const huecos = huecosDeDemo(blocks);
  assert.deepEqual(
    huecos.map((h) => [h.blockId, h.ranura]),
    [
      ["ind", "individual"],
      ["grp", "grupal"],
      ["mae", "maestra"],
      ["ami", "amigos"],
      ["lib", "extra"],
    ],
  );
  const demo = demoDePlantilla({ templateId: "x", meta: { categoria: "Primaria" } });
  const subidos = new Set([demo.archivos.individual, demo.archivos.maestra]);
  const fotos = fotosDeDemoPorBloque(huecos, demo, (a) => (subidos.has(a) ? `U/${a}` : null));
  assert.equal(fotos.ind!.src, `U/${demo.archivos.individual}`);
  assert.equal(fotos.mae!.src, "U/con-maestra-primaria.jpg");
  assert.equal(fotos.grp!.src, FOTO_DE_MUESTRA_DATA_URL);
  assert.equal(fotos.lib!.src, FOTO_DE_MUESTRA_DATA_URL);
  assert.ok(FOTO_DE_MUESTRA_DATA_URL.startsWith("data:image/svg+xml"));

  assert.deepEqual(archivosNecesarios(demo, huecos), [
    "amigos-primaria.jpg",
    "con-maestra-primaria.jpg",
    "grupal-primaria.jpg",
    "libre-patio.jpg",
    "logo-escudo-clasico.png",
    demo.archivos.individual,
  ].sort());
});

test("el sello de la miniatura cambia cuando se suben las fotos", () => {
  const nada = selloDeDemo({ "a.jpg": false, "b.jpg": false });
  const una = selloDeDemo({ "a.jpg": true, "b.jpg": false });
  const todas = selloDeDemo({ "b.jpg": true, "a.jpg": true });
  assert.notEqual(nada, una);
  assert.notEqual(una, todas);
  assert.equal(todas, selloDeDemo({ "a.jpg": true, "b.jpg": true }));
  assert.match(todas, /^2de2-[0-9a-z]+$/);
});

test("el mosaico de demo lleva a los compañeros sin el alumno, con retratos de demo en ronda", () => {
  const demo = demoDePlantilla({ templateId: "t1", meta: { categoria: "Primaria" } });
  const url = (archivo: string) => `https://r2.example/template-v2/demo/${archivo}`;
  const mosaico = mosaicoDeDemo(demo, url);
  const companeros = demo.companeros.filter((c) => !c.isOwner);
  assert.equal(mosaico.length, companeros.length);
  assert.ok(!mosaico.some((s) => s.firstName === demo.alumno.firstName && s.lastName === demo.alumno.lastName));
  assert.ok(mosaico.every((s) => s.photoUrl && RETRATOS_DE_COMPANEROS.some((a) => s.photoUrl === url(a))));
  // En ronda: los primeros no repiten foto.
  assert.notEqual(mosaico[0]!.photoUrl, mosaico[1]!.photoUrl);
  // Sin el archivo subido, el chico va sin foto (silueta), nunca con la foto de otro archivo.
  assert.ok(mosaicoDeDemo(demo, () => null).every((s) => s.photoUrl === undefined));
});
