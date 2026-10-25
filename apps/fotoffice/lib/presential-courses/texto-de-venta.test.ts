import { describe, expect, it } from "vitest";
import { bloquesDeVenta } from "./texto-de-venta";

describe("texto de venta", () => {
  it("separa párrafos, subtítulos y listas", () => {
    const texto = [
      "Un taller para especializarte en XV.",
      "",
      "Qué vas a aprender:",
      "",
      "• Por qué XV: diferencias con las bodas.",
      "• Productos para XV.",
      "- Marketing.",
      "",
      "Las clases son grabaciones.",
    ].join("\n");
    expect(bloquesDeVenta(texto)).toEqual([
      { tipo: "parrafo", texto: "Un taller para especializarte en XV." },
      { tipo: "subtitulo", texto: "Qué vas a aprender" },
      { tipo: "lista", items: ["Por qué XV: diferencias con las bodas.", "Productos para XV.", "Marketing."] },
      { tipo: "parrafo", texto: "Las clases son grabaciones." },
    ]);
  });

  it("un renglón largo que termina en dos puntos sigue siendo párrafo", () => {
    const largo = "Este es un párrafo bastante largo que no es un título aunque termine así:";
    expect(bloquesDeVenta(largo)).toEqual([{ tipo: "parrafo", texto: largo }]);
  });
});
