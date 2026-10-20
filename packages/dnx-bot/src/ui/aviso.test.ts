import { describe, expect, it } from "vitest";
import { parseAviso } from "./aviso";
import { applySseEvent } from "./items";

const A = { texto: "Tus números son tuyos: quedan guardados en tu estudio.", enlace: { etiqueta: "Cómo cuidamos tus datos", ruta: "/ayuda/dnx-bot-datos" } };

describe("parseAviso", () => {
  it("acepta el aviso del servidor, con o sin enlace", () => {
    expect(parseAviso(A)).toEqual(A);
    expect(parseAviso({ texto: "Hola" })).toEqual({ texto: "Hola", enlace: null });
  });
  it("el enlace sólo puede ser una ruta interna del panel", () => {
    for (const ruta of ["https://malo.com", "//malo.com", "javascript:alert(1)", "/a:b", "ayuda"]) {
      expect(parseAviso({ ...A, enlace: { ...A.enlace, ruta } })!.enlace).toBeNull();
    }
  });
  it("sin texto → null", () => {
    expect(parseAviso({ texto: "" })).toBeNull();
    expect(parseAviso(null)).toBeNull();
  });
});

describe("evento aviso", () => {
  it("queda como tarjeta fija y el texto del bot sigue debajo", () => {
    expect(applySseEvent([{ kind: "bot", text: "" }], "aviso", A).map((i) => i.kind)).toEqual(["bot", "aviso", "bot"]);
  });
});
