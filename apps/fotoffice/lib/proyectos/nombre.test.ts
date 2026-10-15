import { describe, expect, it } from "vitest";
import { aplicarPlantillaNombre } from "./nombre";

const v = { contacto: "Ana Pérez", producto: "Fotolibro 30×30", evento: "05/12/2026", pedido: "PED-0007" };

describe("aplicarPlantillaNombre", () => {
  it("por omisión: «{contacto} · {producto}»", () => {
    expect(aplicarPlantillaNombre(null, v)).toBe("Ana Pérez · Fotolibro 30×30");
    expect(aplicarPlantillaNombre("   ", v)).toBe("Ana Pérez · Fotolibro 30×30");
  });
  it("reemplaza las cuatro variables, todas las veces que aparecen", () => {
    expect(aplicarPlantillaNombre("{pedido} {producto} {evento} {contacto} {contacto}", v)).toBe(
      "PED-0007 Fotolibro 30×30 05/12/2026 Ana Pérez Ana Pérez",
    );
  });
  it("una variable sin valor queda vacía; una desconocida se deja", () => {
    expect(aplicarPlantillaNombre("{producto} {evento} {otra}", { producto: "Video", evento: null })).toBe("Video {otra}");
  });
  it("recorta espacios sobrantes", () => {
    expect(aplicarPlantillaNombre("  {contacto}   -   {producto}  ", v)).toBe("Ana Pérez - Fotolibro 30×30");
  });
  it("si queda en blanco, cae a la de por omisión; sin nada, «Proyecto»", () => {
    expect(aplicarPlantillaNombre("{evento}", { contacto: "Ana", producto: "Video" })).toBe("Ana · Video");
    expect(aplicarPlantillaNombre(null, {})).toBe("Proyecto");
    expect(aplicarPlantillaNombre(null, { producto: "Video" })).toBe("Video");
  });
  it("tope de 200 caracteres", () => {
    const largo = aplicarPlantillaNombre("{contacto}", { contacto: "x".repeat(500) });
    expect(largo).toHaveLength(200);
    expect(aplicarPlantillaNombre("{contacto} ", { contacto: `${"x".repeat(199)} y` })).toHaveLength(199);
  });
});
