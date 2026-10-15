import { strict as assert } from "node:assert";
import { test } from "node:test";

import { DNX_ESCOLAR_BRAND, buildPhotographerEscolarBrand } from "./landing-brand";
import { PRIVACIDAD_ESCUELAS_URL, SELFIE_TEXTO, buildCuidadoItems, buildEscolarContent } from "./landing-content";

const FOTOGRAFO = buildPhotographerEscolarBrand({
  publicPageHandler: "estudio-perez",
  name: "Ana Pérez",
  companyName: "Estudio Pérez",
  logoUrl: null,
  email: "ana@example.com",
  whatsapp: null,
  phone: null,
  companyAddress: null,
  city: null,
  primaryColor: null,
});

test("el texto de la selfie es el acordado (tope de 90 días y borrado con enlace)", () => {
  assert.equal(
    SELFIE_TEXTO,
    "La selfie no se guarda: se usa sólo para buscar las fotos y se descarta (si el fotógrafo configura un plazo de conservación, se borra sola al vencer, como máximo a los 90 días, y la familia puede borrarla antes con un enlace).",
  );
  const cuidado = buildCuidadoItems("X");
  assert.equal(cuidado[0].texto, SELFIE_TEXTO);
});

test("la sección de datos cubre selfie, privacidad, vistas previas, original, vencimiento y pagos", () => {
  const titulos = buildCuidadoItems("Estudio Pérez").map((c) => c.titulo).join(" | ");
  for (const tema of [/selfie/i, /privada/i, /sólo sus fotos/i, /vistas previas/i, /original/i, /vencen/i, /pagos/i]) {
    assert.match(titulos, tema);
  }
});

test("la sección de datos no promete lo que el sistema no hace", () => {
  const texto = buildCuidadoItems("Estudio Pérez").map((c) => c.texto).join(" ");
  // Las capturas de pantalla no se pueden impedir: se dice explícitamente.
  assert.match(texto, /Ninguna protección evita del todo una captura de pantalla/);
  assert.doesNotMatch(texto, /imposible|100 ?%|nunca se (podrá|puede) copiar/i);
});

test("la landing de un fotógrafo no menciona a DNX en ningún texto", () => {
  const content = buildEscolarContent(FOTOGRAFO);
  const todo = JSON.stringify(content);
  assert.doesNotMatch(todo, /DNX|Funes|Roldán/);
  assert.match(todo, /Estudio Pérez hace las fotos/);
  assert.match(todo, /Estudio Pérez lo liquida/);
});

test("la landing de DNX conserva sus textos y su beneficio local", () => {
  const content = buildEscolarContent(DNX_ESCOLAR_BRAND);
  assert.equal(content.pasos.length, 6);
  assert.equal(content.pasos[3].titulo, "DNX Estudio hace las fotos");
  assert.equal(content.beneficios.length, 8);
  assert.equal(content.beneficios.at(-1)?.titulo, "Servicio local");
  assert.match(content.beneficios.at(-1)?.texto ?? "", /Funes/);
});

test("sin ciudad no se inventa un beneficio local", () => {
  const content = buildEscolarContent(FOTOGRAFO);
  assert.equal(content.beneficios.length, 7);
  assert.ok(!content.beneficios.some((b) => /local|cercana/i.test(b.titulo)));
});

test("las preguntas frecuentes incluyen selfie, privacidad entre familias y la plataforma", () => {
  const faqs = buildEscolarContent(FOTOGRAFO).faqs;
  const preguntas = faqs.map((f) => f.q);
  assert.ok(preguntas.includes("¿Qué pasa con la selfie que sube una familia?"));
  assert.ok(preguntas.includes("¿Una familia puede ver las fotos de otros chicos?"));
  assert.ok(preguntas.includes("¿Qué es ComprameLaFoto?"));
  assert.equal(faqs.find((f) => f.q.includes("selfie"))?.a, SELFIE_TEXTO);
  assert.equal(new Set(preguntas).size, preguntas.length, "sin preguntas repetidas");
});

test("el enlace de privacidad apunta a la política para escuelas", () => {
  assert.equal(PRIVACIDAD_ESCUELAS_URL, "/privacidad/escuelas");
});
