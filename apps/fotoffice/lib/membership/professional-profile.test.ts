import { describe, expect, it } from "vitest";
import { parsePerfilProfesional } from "./professional-profile";

describe("parsePerfilProfesional", () => {
  it("normaliza igual que el formulario público", () => {
    const r = parsePerfilProfesional({
      instagram: "https://www.instagram.com/EstudioAna/",
      website: "estudioana.com.ar",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.instagram).toBe("estudioana");
      expect(r.data.website).toBe("https://estudioana.com.ar/");
    }
  });

  it("vaciar un campo lo borra, no lo deja en blanco", () => {
    const r = parsePerfilProfesional({ businessName: "   ", instagram: "" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.businessName).toBeNull();
      expect(r.data.instagram).toBeNull();
    }
  });

  it("señala el campo exacto cuando algo está mal", () => {
    const r = parsePerfilProfesional({ instagram: "https://facebook.com/ana" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("instagram");
  });

  it("rechaza una presentación más larga que el máximo", () => {
    const r = parsePerfilProfesional({ bio: "x".repeat(601) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("bio");
  });

  it("no autoriza el directorio si no lo marcaron", () => {
    const r = parsePerfilProfesional({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.directoryOptIn).toBe(false);
  });

  it("rechaza un rubro inventado", () => {
    const r = parsePerfilProfesional({ specialties: ["NO_EXISTE"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("specialties");
  });
});

describe("orden de relevancia de los rubros", () => {
  it("conserva el orden en que los eligió: el primero es a lo que más se dedica", () => {
    const r = parsePerfilProfesional({ specialties: ["XV", "SOCIAL", "CASAMIENTOS"] });
    expect(r.ok).toBe(true);
    // Ni alfabético ni el del catálogo: el de elección.
    if (r.ok) expect(r.data.specialties).toEqual(["XV", "SOCIAL", "CASAMIENTOS"]);
  });

  it("acepta hasta diez", () => {
    const diez = ["SOCIAL","CASAMIENTOS","XV","RETRATO","INFANTIL","ESCOLAR","PRODUCTO","MODA","DEPORTES","PRENSA"];
    const r = parsePerfilProfesional({ specialties: diez });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.specialties).toEqual(diez);
  });

  it("y rechaza el undécimo", () => {
    const once = ["SOCIAL","CASAMIENTOS","XV","RETRATO","INFANTIL","ESCOLAR","PRODUCTO","MODA","DEPORTES","PRENSA","NATURALEZA"];
    const r = parsePerfilProfesional({ specialties: once });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("specialties");
  });

  it("una repetida no ocupa dos lugares ni corre el orden", () => {
    const r = parsePerfilProfesional({ specialties: ["XV", "SOCIAL", "XV"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.specialties).toEqual(["XV", "SOCIAL"]);
  });

  it("XV es un rubro válido", () => {
    const r = parsePerfilProfesional({ specialties: ["XV"] });
    expect(r.ok).toBe(true);
  });
});
