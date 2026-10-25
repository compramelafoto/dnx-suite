import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cleanEmailCode,
  generateEmailCode,
  hashEmailCode,
  isProfileComplete,
  normalizeInstagram,
  normalizeWhatsapp,
  splitName,
  validateProfile,
} from "./photographer-profile";

test("el WhatsApp se acepta como lo escribe la gente y queda en formato internacional", () => {
  assert.equal(normalizeWhatsapp("341 155 123456"), "+5493415123456");
  assert.equal(normalizeWhatsapp("0341-15-5123456"), "+5493415123456");
  assert.equal(normalizeWhatsapp("+54 9 341 5123456"), "+5493415123456");
  assert.equal(normalizeWhatsapp("11 2345 6789"), "+5491123456789");
  assert.equal(normalizeWhatsapp("+598 99 123 456"), "+59899123456");
  assert.equal(normalizeWhatsapp("1234"), null);
  assert.equal(normalizeWhatsapp(""), null);
});

test("Instagram: con @, sin @ o con el enlace completo", () => {
  assert.equal(normalizeInstagram("@Debora.Fotos"), "debora.fotos");
  assert.equal(normalizeInstagram("https://www.instagram.com/dnx_foto/?hl=es"), "dnx_foto");
  assert.equal(normalizeInstagram("con espacios"), null);
});

test("el formulario pide nombre, apellido, WhatsApp, empresa y ciudad ubicada en el mapa", () => {
  const bad = validateProfile({ firstName: "A", whatsapp: "12", city: "Rosario" });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    for (const k of ["firstName", "lastName", "whatsapp", "company", "city"]) assert.ok(k in bad.errors, k);
  }
  const good = validateProfile({
    firstName: "Daniel",
    lastName: "Cuart",
    whatsapp: "341 5123456",
    instagram: "",
    company: "DNX Fotografía",
    city: "Rosario",
    province: "Santa Fe",
    country: "Argentina",
    latitude: -32.95,
    longitude: -60.65,
    jobAlerts: true,
  });
  assert.equal(good.ok, true);
  if (good.ok) {
    assert.equal(good.profile.whatsapp, "+5493415123456");
    assert.equal(good.profile.instagram, null);
    assert.equal(good.profile.jobAlerts, true);
  }
  // Sin marcar, el aviso de trabajos queda apagado (consentimiento explícito).
  const noAlerts = validateProfile({ firstName: "Ana", lastName: "Paz", whatsapp: "3415123456", company: "Independiente", city: "Rosario", latitude: -32.9, longitude: -60.6 });
  assert.ok(noAlerts.ok && noAlerts.profile.jobAlerts === false);
});

test("una cuenta está completa con nombre y apellido, WhatsApp, empresa y ciudad en el mapa", () => {
  const base = { name: "Daniel Cuart", whatsapp: "+5493415123456", companyName: "DNX", city: "Rosario", latitude: -32.9, longitude: -60.6 };
  assert.equal(isProfileComplete(base), true);
  assert.equal(isProfileComplete({ ...base, name: "Daniel" }), false);
  assert.equal(isProfileComplete({ ...base, latitude: null }), false);
  assert.deepEqual(splitName("María José Pérez"), { firstName: "María José", lastName: "Pérez" });
});

test("el código de email: 6 dígitos, atado al email y tolerante a espacios", () => {
  const code = generateEmailCode();
  assert.match(code, /^\d{6}$/);
  assert.equal(cleanEmailCode("123 456"), "123456");
  assert.equal(cleanEmailCode("12345"), null);
  assert.notEqual(hashEmailCode("a@x.com", "123456"), hashEmailCode("b@x.com", "123456"));
  assert.equal(hashEmailCode("A@x.com ", "123456"), hashEmailCode("a@x.com", "123456"));
});
