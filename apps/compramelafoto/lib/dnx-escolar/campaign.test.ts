import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildCampaignEmail, buildMailtoUrl, escapeHtml, sanitizeHeaderValue } from "./campaign-email";
import {
  decideAfterFailure,
  normalizeEmail,
  normalizePhone,
  sendIdempotencyKey,
  stateFromProviderEvent,
} from "./campaign-states";
import { addressKey, matchProspectToClf, normalizeSchoolName, type ClfSchoolRow } from "./clf-school-match";

test("el correo conserva el texto fijo y sólo cambia saludo y enlaces", () => {
  const email = buildCampaignEmail({ institutionName: "Colegio San José" });
  assert.equal(email.subject, "Fotografía escolar sin gestionar cobros");
  assert.equal(email.from, "Daniel Cuart | DNX Estudio <info@compramelafoto.com>");
  assert.equal(email.replyTo, "dnxfotografia@gmail.com");
  assert.match(email.html, /Hola, equipo de Colegio San José:/);
  assert.match(email.text, /^Hola, equipo de Colegio San José:/);
  assert.match(email.text, /Conocer la propuesta: https:\/\/www\.compramelafoto\.com\/dnx\/escolar\?utm_source=email/);
  assert.match(email.text, /Escribirme por email: dnxfotografia@gmail\.com/);
  assert.match(email.text, /Atendemos en San José 1672, Local 5, Funes\./);
  assert.ok(email.headers["List-Unsubscribe"].startsWith("<mailto:dnxfotografia@gmail.com?subject="));
});

test("los enlaces llevan UTM de la campaña y el mailto va codificado", () => {
  const email = buildCampaignEmail({ institutionName: "Nuestra Señora del Huerto" });
  const url = new URL(email.proposalUrl);
  assert.equal(url.pathname, "/dnx/escolar");
  assert.equal(url.searchParams.get("utm_campaign"), "dnx-escolar-2026-10");
  assert.equal(url.searchParams.get("utm_medium"), "email");
  assert.equal(
    buildMailtoUrl("dnxfotografia@gmail.com", "Nuestra Señora del Huerto"),
    "mailto:dnxfotografia@gmail.com?subject=" +
      encodeURIComponent("Consulta fotografía escolar — Nuestra Señora del Huerto")
  );
  assert.ok(!email.mailtoUrl.includes(" "));
});

test("un nombre con HTML o saltos de línea no rompe el correo ni los encabezados", () => {
  const email = buildCampaignEmail({ institutionName: 'Escuela <b>"X"</b>\r\nBcc: otro@x.com' });
  assert.ok(!email.html.includes("<b>"));
  assert.match(email.html, /&lt;b&gt;&quot;X&quot;&lt;\/b&gt;/);
  assert.ok(!decodeURIComponent(email.mailtoUrl).includes("\n"));
  assert.equal(sanitizeHeaderValue("a\r\nb"), "a b");
  assert.equal(escapeHtml(`<a href="x">'`), "&lt;a href=&quot;x&quot;&gt;&#39;");
  assert.throws(() => buildCampaignEmail({ institutionName: "  \n " }));
});

test("normaliza emails y teléfonos sin cambiar su identidad", () => {
  assert.equal(normalizeEmail("  Info@ColegioX.edu.AR "), "info@colegiox.edu.ar");
  assert.equal(normalizeEmail("miseedu.com"), null);
  assert.equal(normalizePhone("0341-4392571"), "03414392571");
  assert.equal(normalizePhone("4392571"), "03414392571");
  assert.equal(normalizePhone("0341 4932752 / 4937350"), "03414932752");
});

test("reintenta sólo fallos transitorios y con tope", () => {
  assert.deepEqual(decideAfterFailure({ statusCode: 429 }, 1), { status: "LISTO", retry: true });
  assert.deepEqual(decideAfterFailure({ statusCode: 503 }, 1), { status: "LISTO", retry: true });
  assert.deepEqual(decideAfterFailure({ statusCode: null }, 2), { status: "LISTO", retry: true });
  assert.deepEqual(decideAfterFailure({ statusCode: 503 }, 3), { status: "FALLIDO", retry: false });
  assert.deepEqual(decideAfterFailure({ statusCode: 422, name: "validation_error" }, 1), {
    status: "FALLIDO",
    retry: false,
  });
  assert.deepEqual(decideAfterFailure({ statusCode: 403 }, 1), { status: "FALLIDO", retry: false });
});

test("la clave de idempotencia es estable por campaña y administración", () => {
  assert.equal(sendIdempotencyKey("c1", "ROS-PRIM-1012+ROS-SEC-2043"), sendIdempotencyKey("c1", "ROS-PRIM-1012+ROS-SEC-2043"));
  assert.notEqual(sendIdempotencyKey("c1", "A"), sendIdempotencyKey("c2", "A"));
  assert.equal(stateFromProviderEvent("bounced"), "REBOTADO");
  assert.equal(stateFromProviderEvent("complained"), "NO_CONTACTAR");
  assert.equal(stateFromProviderEvent("delivered"), null);
});

const SCHOOLS: ClfSchoolRow[] = [
  { id: 12, name: "Instituto Virgen del Rosario", city: "Rosario", address: "2763 Salta, Rosario, Santa Fe, Argentina", contactEmail: null, contactPhone: "0341-4392571" },
  { id: 13, name: "Colegio San Patricio", city: "Rosario", address: "2643 Salta, Rosario, Santa Fe, Argentina", contactEmail: null, contactPhone: null },
  { id: 35, name: "Colegio Ntra. Sra. de Los Ángeles", city: "Rosario", address: null, contactEmail: null, contactPhone: null },
  { id: 40, name: "San José", city: "Rosario", address: null, contactEmail: null, contactPhone: null },
  { id: 41, name: "Escuela X", city: "Funes", address: null, contactEmail: "admin@x.edu.ar", contactPhone: null },
];

test("cruce CLF: domicilio, teléfono o email dan coincidencia inequívoca", () => {
  const byAddress = matchProspectToClf(
    { institutionName: "VIRGEN DEL ROSARIO", locality: "Rosario", addresses: ["SALTA 2763"], emails: [], phones: [] },
    SCHOOLS
  );
  assert.equal(byAddress?.kind, "inequivoca");
  assert.equal(byAddress?.schoolId, 12);
  const byEmail = matchProspectToClf(
    { institutionName: "Otra", locality: "Funes", addresses: [], emails: ["ADMIN@x.edu.ar"], phones: [] },
    SCHOOLS
  );
  assert.equal(byEmail?.schoolId, 41);
  assert.equal(addressKey("BV. OROÑO 960"), addressKey("960 Bulevar Oroño, Rosario"));
  assert.equal(addressKey("H. Yrigoyen 3602"), addressKey("3602 Hipólito Yrigoyen, Funes, Santa Fe, Argentina"));
  assert.equal(addressKey("REGIMIENTO 11 Nº 1527"), "regimiento 1527");
  assert.notEqual(addressKey("REGIMIENTO 11 N° 1123"), addressKey("REGIMIENTO 11 N° 865"));
});

test("cruce CLF: un nombre parecido en otra calle sólo es posible, y uno genérico nunca es inequívoco", () => {
  const angeles = matchProspectToClf(
    { institutionName: "NUESTRA SEÑORA DE LOS ANGELES", locality: "Rosario", addresses: ["TUCUMAN 1676"], emails: [], phones: [] },
    SCHOOLS
  );
  assert.equal(angeles?.kind, "posible");
  assert.equal(angeles?.schoolId, 35);
  const sanJose = matchProspectToClf(
    { institutionName: "SAN JOSE", locality: "Rosario", addresses: ["Presidente Roca 150"], emails: [], phones: [] },
    SCHOOLS
  );
  assert.equal(sanJose?.kind, "posible");
  assert.match(sanJose?.reason ?? "", /genérico/);
  const otraCiudad = matchProspectToClf(
    { institutionName: "SAN JOSE", locality: "Funes", addresses: [], emails: [], phones: [] },
    SCHOOLS
  );
  assert.equal(otraCiudad, null);
  assert.equal(normalizeSchoolName("Colegio Ntra. Sra. de Los Ángeles"), "nuestra senora de los angeles");
});

test("no confunde 'Colegio Rosario' con otros colegios que contienen la palabra Rosario", () => {
  const match = matchProspectToClf(
    { institutionName: "NUESTRA SEÑORA DEL ROSARIO", locality: "Rosario", addresses: ["Mitre 100"], emails: [], phones: [] },
    [{ id: 34, name: "Colegio Rosario", city: "Rosario", address: null, contactEmail: null, contactPhone: null }]
  );
  assert.equal(match, null);
});
