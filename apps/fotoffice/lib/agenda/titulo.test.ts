import { describe, expect, it } from "vitest";
import { aplicarPlantillaTitulo } from "./titulo";

describe("aplicarPlantillaTitulo", () => {
  const v = { contacto: "Laura Pérez", producto: "Álbum", evento: "12/12/2026", pedido: "2026-0001" };
  it("reemplaza las variables y limpia los espacios", () => {
    expect(aplicarPlantillaTitulo("  {producto}  de {contacto} ({pedido}) ", v)).toBe("Álbum de Laura Pérez (2026-0001)");
  });
  it("sin plantilla es el producto, y sin producto «Cita»", () => {
    expect(aplicarPlantillaTitulo(null, v)).toBe("Álbum");
    expect(aplicarPlantillaTitulo("   ", v)).toBe("Álbum");
    expect(aplicarPlantillaTitulo("{evento}", { producto: null })).toBe("Cita");
  });
  it("una variable desconocida queda tal cual y el tope es de 200", () => {
    expect(aplicarPlantillaTitulo("Hola {otra}", v)).toBe("Hola {otra}");
    expect(aplicarPlantillaTitulo("x".repeat(300), v)).toHaveLength(200);
  });
});
