import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseSchoolOrganizerProfilePatch,
  shouldClearSchoolCoordinates,
} from "@/lib/school-organizer-profile-logic";
import { getSchoolLogoExtension, validateSchoolLogoFile } from "@/lib/school-logo-logic";

describe("perfil de escuela editable por el organizador", () => {
  it("acepta contacto y ubicación, recortando espacios", () => {
    const r = parseSchoolOrganizerProfilePatch({
      contactEmail: "  Secretaria@Colegio.edu.AR ",
      contactPhone: "+54 (341) 555-1234",
      address: "  Av.   Pellegrini 1234 ",
      city: "Rosario",
      province: "Santa Fe",
      country: "Argentina",
    });
    assert.deepEqual(r, {
      ok: true,
      data: {
        contactEmail: "secretaria@colegio.edu.ar",
        contactPhone: "+54 (341) 555-1234",
        address: "Av. Pellegrini 1234",
        city: "Rosario",
        province: "Santa Fe",
        country: "Argentina",
      },
    });
  });

  it("vacío o null borra el dato", () => {
    const r = parseSchoolOrganizerProfilePatch({ contactPhone: "  ", city: null });
    assert.deepEqual(r, { ok: true, data: { contactPhone: null, city: null } });
  });

  for (const key of ["name", "slug", "ownerId", "notes", "latitude", "id"]) {
    it(`rechaza el campo prohibido ${key}`, () => {
      const r = parseSchoolOrganizerProfilePatch({ city: "Rosario", [key]: "x" });
      assert.equal(r.ok, false);
      if (!r.ok) assert.match(r.error, new RegExp(key));
    });
  }

  it("rechaza email mal formado", () => {
    assert.equal(parseSchoolOrganizerProfilePatch({ contactEmail: "colegio@" }).ok, false);
    assert.equal(parseSchoolOrganizerProfilePatch({ contactEmail: "a b@c.com" }).ok, false);
  });

  it("rechaza teléfonos con letras o muy cortos", () => {
    assert.equal(parseSchoolOrganizerProfilePatch({ contactPhone: "llamar a Ana" }).ok, false);
    assert.equal(parseSchoolOrganizerProfilePatch({ contactPhone: "123" }).ok, false);
    assert.equal(parseSchoolOrganizerProfilePatch({ contactPhone: "341 555 1234" }).ok, true);
  });

  it("rechaza textos demasiado largos", () => {
    assert.equal(parseSchoolOrganizerProfilePatch({ city: "a".repeat(121) }).ok, false);
    assert.equal(parseSchoolOrganizerProfilePatch({ city: "a".repeat(120) }).ok, true);
    assert.equal(parseSchoolOrganizerProfilePatch({ address: "a".repeat(301) }).ok, false);
  });

  it("rechaza tipos que no son texto", () => {
    assert.equal(parseSchoolOrganizerProfilePatch({ city: 123 }).ok, false);
    assert.equal(parseSchoolOrganizerProfilePatch({ address: { x: 1 } }).ok, false);
  });

  it("logoUrl sólo se acepta para quitarlo", () => {
    assert.deepEqual(parseSchoolOrganizerProfilePatch({ logoUrl: null }), {
      ok: true,
      data: { logoUrl: null },
    });
    assert.equal(
      parseSchoolOrganizerProfilePatch({ logoUrl: "https://otro-sitio.com/logo.png" }).ok,
      false
    );
  });

  it("rechaza cuerpo vacío o que no es objeto", () => {
    assert.equal(parseSchoolOrganizerProfilePatch({}).ok, false);
    assert.equal(parseSchoolOrganizerProfilePatch(null).ok, false);
    assert.equal(parseSchoolOrganizerProfilePatch([]).ok, false);
    assert.equal(parseSchoolOrganizerProfilePatch("city=Rosario").ok, false);
  });

  it("limpia coordenadas sólo si cambia la dirección", () => {
    assert.equal(shouldClearSchoolCoordinates({ address: "Otra 1" }, { address: "Calle 1" }), true);
    assert.equal(shouldClearSchoolCoordinates({ address: "Calle 1" }, { address: "Calle 1" }), false);
    assert.equal(shouldClearSchoolCoordinates({ city: "Rosario" }, { address: "Calle 1" }), false);
    assert.equal(shouldClearSchoolCoordinates({ address: null }, { address: null }), false);
  });
});

describe("logo de escuela", () => {
  it("acepta JPG/PNG/WebP/GIF de hasta 5 MB", () => {
    assert.deepEqual(validateSchoolLogoFile({ type: "image/PNG", size: 1000, name: "logo.png" }), {
      ok: true,
      contentType: "image/png",
      extension: "png",
    });
    assert.equal(validateSchoolLogoFile({ type: "image/jpeg", size: 5 * 1024 * 1024 }).ok, true);
  });

  it("rechaza otros formatos, vacíos y archivos grandes", () => {
    assert.equal(validateSchoolLogoFile({ type: "application/pdf", size: 1000 }).ok, false);
    assert.equal(validateSchoolLogoFile({ type: "image/svg+xml", size: 1000 }).ok, false);
    assert.equal(validateSchoolLogoFile({ type: "image/png", size: 0 }).ok, false);
    assert.equal(validateSchoolLogoFile({ type: "image/png", size: 5 * 1024 * 1024 + 1 }).ok, false);
  });

  it("deduce la extensión", () => {
    assert.equal(getSchoolLogoExtension("image/webp", "foto"), "webp");
    assert.equal(getSchoolLogoExtension("image/jpeg", "LOGO.JPEG"), "jpeg");
    assert.equal(getSchoolLogoExtension("image/jpeg", null), "jpg");
  });
});
