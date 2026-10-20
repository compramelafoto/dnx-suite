import { describe, expect, it } from "vitest";
import { decidirCampos, huellaCampo, huellasDe, porMapa } from "./campos";
import { crudo, mapaDe } from "./ejemplos-alboom";

describe("no pisar lo editado en FOTOFFICE", () => {
  it("primera vez que se ata a un registro existente: sólo completa los vacíos", () => {
    const r = decidirCampos({ email: "a@x.test", phone: "543410000000", city: "Funes" }, { email: "otro@x.test", phone: null, city: "" }, null);
    expect(r.cambios).toEqual({ phone: "543410000000", city: "Funes" });
    expect(r.conservados).toEqual(["email"]);
    expect(r.huellas.email).toBe(huellaCampo("a@x.test"));
  });

  it("ya cargado: si Alboom no cambió el campo, no se toca aunque FOTOFFICE tenga otro valor", () => {
    const previas = huellasDe({ city: "Funes" });
    const r = decidirCampos({ city: "Funes" }, { city: "Roldán" }, previas);
    expect(r.cambios).toEqual({});
    expect(r.conservados).toEqual([]);
  });

  it("ya cargado: Alboom cambió y en FOTOFFICE sigue como se cargó → se actualiza", () => {
    const r = decidirCampos({ city: "Rosario" }, { city: "Funes" }, huellasDe({ city: "Funes" }));
    expect(r.cambios).toEqual({ city: "Rosario" });
  });

  it("ya cargado: Alboom cambió pero alguien lo editó en FOTOFFICE → se conserva (conflicto)", () => {
    const r = decidirCampos({ city: "Rosario" }, { city: "Roldán" }, huellasDe({ city: "Funes" }));
    expect(r.cambios).toEqual({});
    expect(r.conservados).toEqual(["city"]);
  });

  it("un vacío de Alboom nunca borra, y un valor igual no es cambio", () => {
    const r = decidirCampos({ city: null, phone: "", email: "a@x.test" }, { city: "Funes", phone: "1", email: "a@x.test" }, null);
    expect(r).toMatchObject({ cambios: {}, conservados: [] });
  });

  it("porMapa: misma huella → IGUAL sin escribir; borrado en FOTOFFICE → OMITIR sin recrear", () => {
    const c = crudo("contactos", "1", { a: 1 });
    expect(porMapa(c, undefined, () => true)).toBeNull();
    expect(porMapa(c, mapaDe(c, "CLIENT", "cli1"), () => true)).toEqual({ accion: "IGUAL", targetId: "cli1", escribirMapa: false });
    expect(porMapa(c, mapaDe(c, "CLIENT", "cli1"), () => false)?.accion).toBe("OMITIR");
    expect(porMapa(crudo("contactos", "1", { a: 2 }), mapaDe(c, "CLIENT", "cli1"), () => true)).toBeNull();
  });
});
