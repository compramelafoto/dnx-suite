import { describe, expect, test } from "vitest";
import { revisarComprador } from "./comprador";

const BUENO = { nombre: "Ana", email: "ana@ejemplo.com", telefono: "3411234567" };

describe("los datos del comprador", () => {
  test("unos datos completos pasan", () => {
    const r = revisarComprador(BUENO);
    expect(r.ok).toBe(true);
    expect(r.ok && r.datos.email).toBe("ana@ejemplo.com");
  });

  test("el correo se guarda en minúsculas y sin espacios", () => {
    // La gente escribe con mayúscula en el celular. Guardar dos veces la misma
    // dirección con distinta capitalización rompe la búsqueda por comprador.
    const r = revisarComprador({ ...BUENO, email: "  Ana@Ejemplo.COM " });
    expect(r.ok && r.datos.email).toBe("ana@ejemplo.com");
  });

  test("sin teléfono se acepta igual", () => {
    // No hace falta para cobrar ni para entregar. Pedirlo obligatorio pierde ventas.
    expect(revisarComprador({ ...BUENO, telefono: "" }).ok).toBe(true);
    expect(revisarComprador({ nombre: "Ana", email: "ana@ejemplo.com" }).ok).toBe(true);
  });

  test("un correo mal escrito no pasa, y el mensaje dice para qué es", () => {
    const r = revisarComprador({ ...BUENO, email: "ana@ejemplo" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/correo/i);
  });

  test.each(["", " ", "A", "  a  "])("«%s» no es un nombre", (nombre) => {
    expect(revisarComprador({ ...BUENO, nombre }).ok).toBe(false);
  });

  test("no revienta con cualquier cosa", () => {
    for (const basura of [{}, { nombre: 42, email: null }, { email: [] }]) {
      expect(revisarComprador(basura).ok).toBe(false);
    }
  });

  test("recorta lo demasiado largo en vez de romperse", () => {
    const r = revisarComprador({ ...BUENO, telefono: "9".repeat(200) });
    expect(r.ok && r.datos.telefono?.length).toBe(40);
  });
});
