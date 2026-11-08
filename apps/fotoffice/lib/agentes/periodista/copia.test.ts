import { describe, expect, it } from "vitest";
import { frasesCopiadas, palabras, textoDeHtml } from "./copia";

const FUENTE =
  "La nueva cámara sin espejo incorpora un sensor de 45 megapíxeles con estabilización en cinco ejes y graba video 8K sin recorte a treinta cuadros por segundo, según anunció la marca.";

describe("palabras", () => {
  it("minúsculas, sin tildes ni puntuación", () => {
    expect(palabras("¡Cámara, ÓPTICA y 8K!")).toEqual(["camara", "optica", "y", "8k"]);
  });
});

describe("textoDeHtml", () => {
  it("saca scripts, estilos y etiquetas, y decodifica entidades", () => {
    const html = `<html><head><style>p{color:red}</style><script>var a = "<p>no</p>";</script></head><body><h1>T&iacute;tulo</h1><p>Uno &amp; dos&nbsp;tres &#233; &#x41;</p><!-- comentario --></body></html>`;
    expect(textoDeHtml(html)).toBe("Título Uno & dos tres é A");
  });
});

describe("frasesCopiadas", () => {
  it("una nota propia no tiene copia", () => {
    const nota = "La marca presentó una cámara con un sensor de alta resolución y video 8K, pensada para quienes hacen bodas y documental.";
    expect(frasesCopiadas(nota, [FUENTE])).toEqual([]);
  });

  it("detecta un copiar-pegar aunque cambie la puntuación o las mayúsculas", () => {
    const nota = "Te contamos: INCORPORA UN SENSOR DE 45 megapíxeles, con estabilización en cinco ejes y graba video 8K sin recorte. Nada más.";
    const frases = frasesCopiadas(nota, [FUENTE]);
    expect(frases).toHaveLength(1);
    expect(frases[0]).toBe("incorpora un sensor de 45 megapixeles con estabilizacion en cinco ejes y graba video 8k sin recorte");
  });

  it("11 palabras iguales seguidas no alcanzan (el tope es 12)", () => {
    const nota = "Dicen que incorpora un sensor de 45 megapíxeles con estabilización en cinco, y además mucho más.";
    expect(frasesCopiadas(nota, [FUENTE])).toEqual([]);
  });

  it("revisa contra varios extractos y sin extractos no hay nada que comparar", () => {
    const cita = "el jurado eligió como ganadora una serie sobre los pescadores del río Paraná tomada durante tres inviernos";
    const nota = `Gran noticia: el jurado eligió como ganadora una serie sobre los pescadores del río Paraná tomada durante tres inviernos.`;
    expect(frasesCopiadas(nota, [FUENTE, cita])).toHaveLength(1);
    expect(frasesCopiadas(nota, [])).toEqual([]);
  });

  it("dos copias separadas cuentan como dos frases", () => {
    const otra = "los organizadores confirmaron que la convocatoria cierra el treinta de noviembre a la medianoche hora argentina";
    const nota = `${FUENTE} Y además ${otra}.`;
    expect(frasesCopiadas(nota, [FUENTE, otra])).toHaveLength(2);
  });
});
