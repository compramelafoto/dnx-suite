import { describe, expect, test } from "vitest";
import { TEXTURAS, dibujoDeTextura, texturaValida } from "./texturas";

describe("qué texturas se aceptan", () => {
  test("las de la lista, sí", () => {
    for (const t of TEXTURAS) expect(texturaValida(t.clave)).toBe(t.clave);
  });

  test("cualquier otra cosa cae en ninguna", () => {
    /*
      La textura termina dentro de un atributo `style` de la página del invitado. Si
      entrara cualquier texto, un evento con los tokens manipulados podría inyectar CSS
      —o una `url()` que se lleva datos a otro servidor— en la pantalla del salón.
      Por eso la lista es cerrada y lo que no está en ella no existe.
    */
    expect(texturaValida("url(http://ajeno/x.png)")).toBe("ninguna");
    expect(texturaValida("estrellas; background: red")).toBe("ninguna");
    expect(texturaValida("")).toBe("ninguna");
    expect(texturaValida(null)).toBe("ninguna");
    expect(texturaValida(42)).toBe("ninguna");
  });
});

describe("el dibujo de la textura", () => {
  test("ninguna no dibuja nada", () => {
    expect(dibujoDeTextura("ninguna", "#FFFFFF")).toBeNull();
  });

  test("las demás devuelven una imagen lista para el fondo", () => {
    for (const t of TEXTURAS) {
      if (t.clave === "ninguna") continue;
      const dibujo = dibujoDeTextura(t.clave, "#FFD51F");
      expect(dibujo).not.toBeNull();
      expect(dibujo!.imagen.startsWith('url("data:image/svg+xml,')).toBe(true);
    }
  });

  test("el color del acento entra codificado y no crudo", () => {
    // `#` sin codificar corta la URL de datos y la textura no se ve.
    const dibujo = dibujoDeTextura("estrellas", "#FFD51F");

    expect(dibujo!.imagen).toContain("%23FFD51F");
    expect(dibujo!.imagen).not.toContain("#FFD51F");
  });

  test("un acento inválido no se cuela en el SVG", () => {
    /*
      El color viene de `resolverTema`, que ya lo valida, pero esta función es pública y
      alguien la puede llamar de otro lado. Que se defienda sola.
    */
    const dibujo = dibujoDeTextura("estrellas", '"/><script>alert(1)</script>');

    expect(dibujo!.imagen).not.toContain("script");
  });
});
