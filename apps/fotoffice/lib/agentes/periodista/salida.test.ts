import { describe, expect, it } from "vitest";
import { contarPalabras, extraerJson, notaATiptap, parsearNota, parsearReescritura, textoDeLaNota } from "./salida";

const parrafo = (n: number) => ({ tipo: "parrafo", texto: Array.from({ length: n }, (_, i) => `palabra${i}`).join(" ") });

const notaValida = {
  fuenteUrl: "https://www.petapixel.com/2026/11/05/nueva-camara/?utm_source=x",
  fuenteTitulo: "Nueva cámara anunciada",
  fuenteMedio: "PetaPixel",
  titulo: "Una cámara nueva para los que hacen bodas",
  bajada: "La marca presentó un modelo con sensor de alta resolución y video 8K.",
  cuerpo: [parrafo(150), { tipo: "subtitulo", texto: "Qué cambia" }, parrafo(150), parrafo(150)],
  tema: "Nueva cámara de 60 MP para bodas",
  categoria: "equipos y lanzamientos",
};

describe("extraerJson", () => {
  it("toma el bloque ```json aunque haya texto alrededor", () => {
    expect(extraerJson('Listo, acá va:\n```json\n{"a": 1}\n```\nSaludos')).toEqual({ a: 1 });
  });

  it("sin bloque, de la primera llave a la última", () => {
    expect(extraerJson('Respuesta: {"a": {"b": 2}} fin')).toEqual({ a: { b: 2 } });
  });

  it("si hay varios bloques, el último que sea JSON válido", () => {
    expect(extraerJson('```json\n{"a": 1}\n```\ny la versión final:\n```json\n{"a": 2}\n```')).toEqual({ a: 2 });
  });

  it("nada parseable: undefined", () => {
    expect(extraerJson("no hay json")).toBeUndefined();
    expect(extraerJson("{roto")).toBeUndefined();
  });
});

describe("parsearNota", () => {
  it("una nota completa pasa y trae la fuente normalizada", () => {
    const r = parsearNota("```json\n" + JSON.stringify(notaValida) + "\n```");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.fuenteUrlNormalizada).toBe("https://petapixel.com/2026/11/05/nueva-camara");
      expect(r.valor.fuenteUrl).toBe(notaValida.fuenteUrl);
    }
  });

  it("falta un campo o el tipo de bloque es otro: error legible", () => {
    const sinTitulo: Partial<typeof notaValida> = { ...notaValida };
    delete sinTitulo.titulo;
    const r = parsearNota(JSON.stringify(sinTitulo));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("titulo");
    const r2 = parsearNota(JSON.stringify({ ...notaValida, cuerpo: [...notaValida.cuerpo, { tipo: "h1", texto: "no" }] }));
    expect(r2.ok).toBe(false);
  });

  it("muy corta o muy larga: error", () => {
    const corta = parsearNota(JSON.stringify({ ...notaValida, cuerpo: [parrafo(50), parrafo(50), parrafo(50)] }));
    expect(corta.ok === false && corta.error).toMatch(/150 palabras/);
    const larga = parsearNota(JSON.stringify({ ...notaValida, cuerpo: [parrafo(400), parrafo(400), parrafo(400)] }));
    expect(larga.ok).toBe(false);
  });

  it("tema y categoría: la categoría se acepta sin tildes ni mayúsculas y vuelve como en la lista", () => {
    const r = parsearNota(JSON.stringify({ ...notaValida, categoria: "Tecnologia e IA" }));
    expect(r.ok && r.valor.categoria).toBe("tecnología e IA");
    expect(r.ok && r.valor.tema).toBe("Nueva cámara de 60 MP para bodas");
    const mala = parsearNota(JSON.stringify({ ...notaValida, categoria: "chismes" }));
    expect(mala.ok === false && mala.error).toMatch(/categoria: tiene que ser una de: concursos y premios/);
    const sinTema: Partial<typeof notaValida> = { ...notaValida };
    delete sinTema.tema;
    const r3 = parsearNota(JSON.stringify(sinTema));
    expect(r3.ok === false && r3.error).toMatch(/tema/);
  });

  it("una fuente que no es dirección: error", () => {
    const r = parsearNota(JSON.stringify({ ...notaValida, fuenteUrl: "petapixel" }));
    expect(r.ok === false && r.error).toMatch(/fuenteUrl/);
  });

  it("sin JSON: error", () => {
    expect(parsearNota("Perdón, no encontré noticias.").ok).toBe(false);
  });
});

describe("parsearReescritura", () => {
  it("sólo título, bajada y cuerpo", () => {
    const r = parsearReescritura(JSON.stringify({ titulo: notaValida.titulo, bajada: notaValida.bajada, cuerpo: notaValida.cuerpo }));
    expect(r.ok).toBe(true);
    expect(parsearReescritura(JSON.stringify({ titulo: "corto" })).ok).toBe(false);
  });
});

describe("contenido Tiptap", () => {
  it("con foto de la noticia, al final va el crédito: «Foto: <medio> — <dominio enlazado>»", () => {
    const doc = notaATiptap([{ tipo: "parrafo", texto: "Uno" }], { url: "https://petapixel.com/a", titulo: "Nota original", medio: "PetaPixel" }, {
      texto: "Jane Doe / PetaPixel",
      url: "https://petapixel.com/a",
      enlace: "petapixel.com",
    });
    expect(doc.content.at(-1)).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "Foto: Jane Doe / PetaPixel — " },
        { type: "text", text: "petapixel.com", marks: [{ type: "link", attrs: { href: "https://petapixel.com/a", target: "_blank", rel: "noopener noreferrer nofollow" } }] },
      ],
    });
    // Sin foto no hay línea de crédito.
    expect(JSON.stringify(notaATiptap([{ tipo: "parrafo", texto: "Uno" }], { url: "https://petapixel.com/a", titulo: "Nota" }, null))).not.toContain("Foto:");
  });

  it("párrafos, subtítulos H2 (nunca H1) y la fuente enlazada al final", () => {
    const doc = notaATiptap(
      [
        { tipo: "parrafo", texto: "Uno" },
        { tipo: "subtitulo", texto: "Dos" },
      ],
      { url: "https://petapixel.com/a", titulo: "Nota original", medio: "PetaPixel" },
    );
    expect(doc).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Uno" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Dos" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Fuente: " },
            { type: "text", text: "PetaPixel: Nota original", marks: [{ type: "link", attrs: { href: "https://petapixel.com/a", target: "_blank", rel: "noopener noreferrer nofollow" } }] },
          ],
        },
      ],
    });
  });

  it("cuenta palabras y junta el texto", () => {
    expect(contarPalabras([{ tipo: "parrafo", texto: "uno dos  tres" }, { tipo: "subtitulo", texto: "cuatro" }])).toBe(4);
    expect(textoDeLaNota({ titulo: "T", bajada: "B", cuerpo: [{ tipo: "parrafo", texto: "C" }] })).toBe("T\nB\nC");
  });
});
