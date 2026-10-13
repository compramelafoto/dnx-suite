import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  DNX_ESCOLAR_BRAND,
  ESCOLAR_DEFAULT_ACCENT,
  PHOTOGRAPHER_ESCOLAR_SOURCE,
  buildMailtoUrl,
  buildPhotographerEscolarBrand,
  buildWhatsappUrl,
  normalizeWhatsappForLink,
  pickAccentColor,
  sanitizePhotographerHandler,
  type EscolarPhotographerProfile,
} from "./landing-brand";
import { DNX_ESCOLAR_SOURCE } from "./lead-notes";

const BASE: EscolarPhotographerProfile = {
  publicPageHandler: "Estudio-Perez",
  name: "Ana Pérez",
  companyName: "Estudio Pérez",
  logoUrl: "https://cdn.example.com/logo.png",
  whatsapp: "341 555-1234",
  phone: null,
  companyAddress: "Córdoba 1234",
  city: "Rosario",
  primaryColor: "#1e3a8a",
};

test("sanitizePhotographerHandler acepta slugs válidos y rechaza el resto", () => {
  assert.equal(sanitizePhotographerHandler(" Estudio-Perez "), "estudio-perez");
  assert.equal(sanitizePhotographerHandler("dnx"), "dnx");
  assert.equal(sanitizePhotographerHandler("../admin"), null);
  assert.equal(sanitizePhotographerHandler("con espacio"), null);
  assert.equal(sanitizePhotographerHandler("-empieza-con-guion"), null);
  assert.equal(sanitizePhotographerHandler(""), null);
  assert.equal(sanitizePhotographerHandler(42), null);
  assert.equal(sanitizePhotographerHandler("a".repeat(64)), null);
});

test("normalizeWhatsappForLink arma el número internacional argentino", () => {
  assert.equal(normalizeWhatsappForLink("341 374-8324"), "5493413748324");
  assert.equal(normalizeWhatsappForLink("0341 155 551234"), null); // con 15: ambiguo, no se inventa
  assert.equal(normalizeWhatsappForLink("0341 3748324"), "5493413748324");
  assert.equal(normalizeWhatsappForLink("+54 9 341 374-8324"), "5493413748324");
  assert.equal(normalizeWhatsappForLink("+54 341 374-8324"), "5493413748324");
  assert.equal(normalizeWhatsappForLink("0054 9 341 3748324"), "5493413748324");
  assert.equal(normalizeWhatsappForLink("1234"), null);
  assert.equal(normalizeWhatsappForLink(null), null);
});

test("buildWhatsappUrl incluye el mensaje con el nombre y no arma enlaces sin número", () => {
  const url = buildWhatsappUrl("341 374-8324", "Estudio Pérez");
  assert.ok(url?.startsWith("https://wa.me/5493413748324?text="));
  assert.match(decodeURIComponent(url!.split("text=")[1]), /Hola Estudio Pérez, escribo desde un colegio/);
  assert.equal(buildWhatsappUrl("", "X"), null);
});

test("buildMailtoUrl valida el email", () => {
  assert.equal(
    buildMailtoUrl("ana@example.com"),
    `mailto:ana@example.com?subject=${encodeURIComponent("Consulta fotografía escolar")}`,
  );
  assert.equal(buildMailtoUrl("no-es-email"), null);
  assert.equal(buildMailtoUrl(null), null);
});

test("pickAccentColor usa el color del fotógrafo sólo si el texto blanco se lee", () => {
  assert.equal(pickAccentColor("#1E3A8A"), "#1e3a8a");
  assert.equal(pickAccentColor("#000"), "#000000");
  assert.equal(pickAccentColor("#ffd700"), ESCOLAR_DEFAULT_ACCENT); // amarillo: ilegible con blanco
  assert.equal(pickAccentColor("#ffffff"), ESCOLAR_DEFAULT_ACCENT);
  assert.equal(pickAccentColor("red"), ESCOLAR_DEFAULT_ACCENT);
  assert.equal(pickAccentColor("#12345"), ESCOLAR_DEFAULT_ACCENT);
  assert.equal(pickAccentColor(null), ESCOLAR_DEFAULT_ACCENT);
});

test("la marca de DNX conserva los datos de /dnx/escolar y no tiene handler", () => {
  assert.equal(DNX_ESCOLAR_BRAND.photographerHandler, null);
  assert.equal(DNX_ESCOLAR_BRAND.source, DNX_ESCOLAR_SOURCE);
  assert.equal(DNX_ESCOLAR_BRAND.nombre, "DNX Estudio");
  assert.equal(DNX_ESCOLAR_BRAND.logoUrl, "/dnx/logo-dnx.png");
  assert.equal(DNX_ESCOLAR_BRAND.accent, ESCOLAR_DEFAULT_ACCENT);
  assert.ok(DNX_ESCOLAR_BRAND.whatsappUrl?.startsWith("https://wa.me/5493413748324?text="));
  assert.equal(DNX_ESCOLAR_BRAND.email, "dnxfotografia@gmail.com");
  assert.match(DNX_ESCOLAR_BRAND.zona, /Rosario, Funes, Roldán/);
});

test("buildPhotographerEscolarBrand arma la marca con los datos del fotógrafo", () => {
  const brand = buildPhotographerEscolarBrand(BASE);
  assert.equal(brand.photographerHandler, "estudio-perez");
  assert.equal(brand.source, PHOTOGRAPHER_ESCOLAR_SOURCE);
  assert.equal(brand.nombre, "Estudio Pérez");
  assert.equal(brand.firma, "Ana Pérez · Rosario");
  assert.equal(brand.zona, "Para colegios e instituciones · Rosario y alrededores");
  assert.equal(brand.direccion, "Córdoba 1234");
  assert.equal(brand.localidad, "Rosario");
  assert.equal(brand.telefonoVisible, "341 555-1234");
  assert.ok(brand.whatsappUrl?.startsWith("https://wa.me/5493415551234?text="));
  // El email de la cuenta es el de inicio de sesión: nunca se publica.
  assert.equal(brand.email, null);
  assert.equal(brand.mailtoUrl, null);
  assert.equal(brand.accent, "#1e3a8a");
  assert.equal(brand.logoUrl, "https://cdn.example.com/logo.png");
  assert.deepEqual(brand.beneficioLocal, { titulo: "Atención cercana", texto: "Estudio Pérez trabaja en Rosario y alrededores." });
  // Nunca menciona a DNX.
  assert.doesNotMatch(JSON.stringify(brand), /DNX|Funes|dnxfotografia/);
});

test("buildPhotographerEscolarBrand tolera un perfil casi vacío", () => {
  const brand = buildPhotographerEscolarBrand({
    publicPageHandler: "foto",
    name: null,
    companyName: "  ",
    logoUrl: null,
    whatsapp: null,
    phone: null,
    companyAddress: null,
    city: null,
    primaryColor: null,
  });
  assert.equal(brand.nombre, "Tu fotógrafo");
  assert.equal(brand.firma, null);
  assert.equal(brand.zona, "Para colegios e instituciones educativas");
  assert.equal(brand.whatsappUrl, null);
  assert.equal(brand.mailtoUrl, null);
  assert.equal(brand.beneficioLocal, null);
  assert.equal(brand.accent, ESCOLAR_DEFAULT_ACCENT);
});

test("buildPhotographerEscolarBrand usa el teléfono si no hay WhatsApp y el nombre si no hay empresa", () => {
  const brand = buildPhotographerEscolarBrand({ ...BASE, companyName: null, whatsapp: null, phone: "3415559999" });
  assert.equal(brand.nombre, "Ana Pérez");
  assert.equal(brand.firma, "Rosario");
  assert.ok(brand.whatsappUrl?.startsWith("https://wa.me/5493415559999"));
});

test("normalizeWhatsappForLink respeta números extranjeros con +", () => {
  assert.equal(normalizeWhatsappForLink("+598 99 123 456"), "59899123456");
});
