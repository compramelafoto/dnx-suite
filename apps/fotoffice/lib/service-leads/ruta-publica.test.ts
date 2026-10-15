import { describe, expect, it } from "vitest";
import { rutaPublicaFormulario } from "./ruta-publica";

describe("rutaPublicaFormulario", () => {
  it("usa la dirección pública real del workspace", () => {
    expect(rutaPublicaFormulario("dnxestudio", "bodas")).toBe("/w/dnxestudio/bodas");
    expect(rutaPublicaFormulario("sfpr", "bodas")).toBe("/w/sfpr/bodas");
  });

  it("el formulario general va a la portada", () => {
    expect(rutaPublicaFormulario("dnxestudio", "general")).toBe("/w/dnxestudio");
  });

  it("sin dirección pública no hay enlace", () => {
    expect(rutaPublicaFormulario(null, "bodas")).toBeNull();
    expect(rutaPublicaFormulario("  ", "bodas")).toBeNull();
  });
});
