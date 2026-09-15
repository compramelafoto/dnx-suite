import { describe, expect, test } from "vitest";
import { revisarLlave } from "./llave-de-servicio";

describe("la llave que protege las rutas de servicio", () => {
  test("sin secreto configurado no se atiende a nadie", () => {
    expect(revisarLlave("Bearer loquesea", undefined)).toBe("sin-configurar");
    expect(revisarLlave("Bearer loquesea", "   ")).toBe("sin-configurar");
  });

  test("con la llave correcta pasa", () => {
    expect(revisarLlave("Bearer abc123", "abc123")).toBe("ok");
  });

  test("con la llave incorrecta no pasa", () => {
    expect(revisarLlave("Bearer otra", "abc123")).toBe("no-autorizado");
  });

  test("sin encabezado no pasa", () => {
    expect(revisarLlave(null, "abc123")).toBe("no-autorizado");
    expect(revisarLlave("", "abc123")).toBe("no-autorizado");
  });

  test("una llave más corta que la buena no pasa", () => {
    // La comparación de tiempo constante rompe si las longitudes difieren: hay que
    // responder igual, no explotar.
    expect(revisarLlave("Bearer a", "abc123")).toBe("no-autorizado");
  });

  test("un prefijo distinto no pasa", () => {
    expect(revisarLlave("abc123", "abc123")).toBe("no-autorizado");
    expect(revisarLlave("Basic abc123", "abc123")).toBe("no-autorizado");
  });

  test("el secreto se compara sin los espacios de los costados", () => {
    // Pegar la variable en Vercel arrastra un salto de línea más veces de las que uno cree.
    expect(revisarLlave("Bearer abc123", " abc123\n")).toBe("ok");
  });
});
