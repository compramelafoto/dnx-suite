import { describe, expect, it } from "vitest";
import { COLUMNAS, columnaDe } from "./columnas";

describe("columnas del tablero", () => {
  it("cuatro columnas en orden del embudo", () => {
    expect(COLUMNAS.map((c) => c.titulo)).toEqual(["Nuevo", "En curso", "Esperando al cliente", "Resuelto"]);
  });
  it("los cerrados se ven en Resuelto", () => {
    expect(columnaDe("CLOSED")).toBe("RESOLVED");
    expect(columnaDe("WAITING_CUSTOMER")).toBe("WAITING_CUSTOMER");
    expect(columnaDe("OPEN")).toBe("OPEN");
  });
});
