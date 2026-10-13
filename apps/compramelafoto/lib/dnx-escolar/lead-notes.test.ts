import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  buildDnxEscolarLeadEmail,
  buildPhotographerEscolarLeadEmail,
  buildSchoolLeadNotes,
  escapeHtml,
  sanitizeLevels,
  sanitizeSource,
  sanitizeUtm,
} from "./lead-notes";

test("sanitizeLevels deja sólo niveles permitidos, sin repetir y en orden", () => {
  assert.deepEqual(sanitizeLevels(["Secundario", "Inicial", "Inicial", "Universitario", 3, " Primario "]), [
    "Inicial",
    "Primario",
    "Secundario",
  ]);
  assert.deepEqual(sanitizeLevels("Inicial"), []);
  assert.deepEqual(sanitizeLevels(undefined), []);
});

test("sanitizeSource acepta un identificador corto y rechaza lo demás", () => {
  assert.equal(sanitizeSource("dnx-escolar"), "dnx-escolar");
  assert.equal(sanitizeSource(" DNX-Escolar "), "dnx-escolar");
  assert.equal(sanitizeSource("<script>"), null);
  assert.equal(sanitizeSource("a".repeat(41)), null);
  assert.equal(sanitizeSource(42), null);
});

test("sanitizeUtm sólo toma claves utm_*, limpia y corta a 100 caracteres", () => {
  const utm = sanitizeUtm({
    utm_source: "  instagram ",
    utm_medium: "<b>bio</b>",
    utm_campaign: "x".repeat(150),
    utm_content: "",
    otro: "ignorado",
  });
  assert.deepEqual(Object.keys(utm).sort(), ["utm_campaign", "utm_medium", "utm_source"]);
  assert.equal(utm.utm_source, "instagram");
  assert.equal(utm.utm_medium, "bbio/b");
  assert.equal(utm.utm_campaign?.length, 100);
  assert.deepEqual(sanitizeUtm(null), {});
  assert.deepEqual(sanitizeUtm(["utm_source"]), {});
});

test("buildSchoolLeadNotes arma un texto legible", () => {
  assert.equal(
    buildSchoolLeadNotes({
      source: "dnx-escolar",
      levels: ["Inicial", "Primario"],
      utm: { utm_source: "instagram", utm_campaign: "marzo" },
    }),
    "Origen: dnx-escolar · Niveles: Inicial, Primario · utm_source=instagram · utm_campaign=marzo",
  );
});

test("buildSchoolLeadNotes devuelve null sin datos extra (retrocompatible con /escuelas)", () => {
  assert.equal(buildSchoolLeadNotes({}), null);
  assert.equal(buildSchoolLeadNotes({ source: null, levels: [], utm: {} }), null);
});

test("escapeHtml escapa los cinco caracteres peligrosos", () => {
  assert.equal(escapeHtml(`<a href="x" onclick='y'>&</a>`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
});

test("buildDnxEscolarLeadEmail escapa todo el contenido dinámico", () => {
  const { subject, html } = buildDnxEscolarLeadEmail({
    leadId: 7,
    schoolName: "Colegio <script>alert(1)</script>",
    city: "Funes\r\nBcc: otro@x.com",
    contactName: "Ana & Co",
    email: "ana@colegio.edu.ar",
    phone: "+5493410000000",
    approxStudents: 350,
    levels: ["Inicial", "Primario"],
    message: `Hola "DNX"\n<img src=x onerror=1>`,
    utm: { utm_source: "ig" },
  });

  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("Colegio &lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes("Ana &amp; Co"));
  assert.ok(html.includes("Hola &quot;DNX&quot;"));
  assert.ok(html.includes("Inicial, Primario"));
  assert.ok(html.includes("350"));
  assert.ok(html.includes("utm_source"));
  assert.ok(!/[\r\n]/.test(subject));
  assert.ok(subject.startsWith("Nueva consulta escolar: Colegio"));
});

test("buildDnxEscolarLeadEmail muestra guiones cuando faltan datos opcionales", () => {
  const { html } = buildDnxEscolarLeadEmail({
    leadId: 1,
    schoolName: "Escuela",
    city: "Roldán",
    contactName: "Pedro",
    email: null,
    phone: "3410000000",
    approxStudents: null,
    levels: [],
    message: null,
    utm: {},
  });
  assert.ok(html.includes("—"));
  assert.ok(!html.includes("Mensaje"));
});

test("buildSchoolLeadNotes registra la landing del fotógrafo", () => {
  assert.equal(
    buildSchoolLeadNotes({ source: "escolar-fotografo", photographerHandler: "estudio-perez", levels: ["Primario"] }),
    "Origen: escolar-fotografo · Landing: /estudio-perez/escolar · Niveles: Primario",
  );
  assert.equal(buildSchoolLeadNotes({ photographerHandler: null }), null);
});

test("buildPhotographerEscolarLeadEmail saluda al fotógrafo, nombra su landing y escapa todo", () => {
  const { subject, html } = buildPhotographerEscolarLeadEmail({
    leadId: 9,
    schoolName: "Colegio <b>San José</b>",
    city: "Rosario",
    contactName: "Marta",
    email: null,
    phone: "+5493415551234",
    approxStudents: 300,
    levels: ["Inicial"],
    message: null,
    utm: {},
    photographerName: "Estudio <Pérez>",
    photographerHandler: "estudio-perez",
  });
  assert.equal(subject, "Nueva consulta escolar: Colegio <b>San José</b> (Rosario)");
  assert.match(html, /Nueva consulta desde tu landing escolar \(\/estudio-perez\/escolar\)/);
  assert.match(html, /Hola Estudio &lt;Pérez&gt;/);
  assert.match(html, /no dejó email: contactalo por teléfono/);
  assert.doesNotMatch(html, /<b>San José<\/b>/);
  assert.doesNotMatch(html, /dnx\/escolar/);
});

test("buildDnxEscolarLeadEmail sigue con el mismo encabezado", () => {
  const { html } = buildDnxEscolarLeadEmail({
    leadId: 1,
    schoolName: "Colegio",
    city: "Funes",
    contactName: "Ana",
    email: "ana@example.com",
    phone: "341",
    approxStudents: null,
    levels: [],
    message: null,
    utm: {},
  });
  assert.match(html, /Nueva consulta desde \/dnx\/escolar/);
  assert.doesNotMatch(html, /Hola /);
});
