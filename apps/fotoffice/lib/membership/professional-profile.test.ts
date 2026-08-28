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
