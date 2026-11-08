import { describe, expect, it } from "vitest";
import { armarMensajePropuesta, datoDeBoton, escaparHtml, leerBoton, mensajeDeFallo, tecladoDePropuesta } from "./mensaje";

const ID = "ckpropuesta00000000000001";
const datos = {
  titulo: "Una cámara nueva para los que hacen bodas",
  bajada: "La marca presentó un modelo con sensor de alta resolución & video 8K.",
  fuenteTitulo: "New camera <announced>",
  fuenteMedio: "PetaPixel",
  fuenteUrl: "https://petapixel.com/a?x=1&y=2",
  editorUrl: "https://fotoffice.app/website/blog/42",
  trabajoTitulo: "Casamiento de Ana y Juan",
};

describe("botones", () => {
  it("ida y vuelta de cada botón, y entra en los 64 bytes", () => {
    for (const accion of ["PUBLICAR", "OTRA", "DESCARTAR"] as const) {
      const d = datoDeBoton(accion, ID);
      expect(Buffer.byteLength(d)).toBeLessThanOrEqual(64);
      expect(leerBoton(d)).toEqual({ accion, propuestaId: ID });
    }
  });

  it("los botones de presupuestos u otra basura no son del Periodista", () => {
    expect(leerBoton("ap:ckaprobacion0001")).toBeNull();
    expect(leerBoton("pe:x:ckpropuesta0001")).toBeNull();
    expect(leerBoton("pe:p:corto")).toBeNull();
  });

  it("el teclado trae Publicar, Otra noticia y Descartar", () => {
    const t = tecladoDePropuesta(ID);
    const textos = t.inline_keyboard.flat().map((b) => b.text);
    expect(textos).toEqual(["✅ Publicar", "🔁 Otra noticia", "❌ Descartar"]);
  });
});

describe("armarMensajePropuesta", () => {
  it("trae título, bajada, fuente, enlace al borrador y foto, todo escapado", () => {
    const html = armarMensajePropuesta(datos, 4096);
    expect(html).toContain("<b>Una cámara nueva para los que hacen bodas</b>");
    expect(html).toContain("alta resolución &amp; video 8K.");
    expect(html).toContain('<a href="https://petapixel.com/a?x=1&amp;y=2">PetaPixel — New camera &lt;announced&gt;</a>');
    expect(html).toContain('<a href="https://fotoffice.app/website/blog/42">Ver y editar el borrador en FOTOFFICE</a>');
    expect(html).toContain("Foto: Casamiento de Ana y Juan");
    expect(html).toContain("respondé a este mensaje");
    expect(html).toContain("Propuesta del Periodista");
  });

  it("las correcciones dicen la versión", () => {
    expect(armarMensajePropuesta({ ...datos, version: 2 }, 4096)).toContain("versión 3");
  });

  it("sin dirección de FOTOFFICE no pone el enlace al borrador", () => {
    expect(armarMensajePropuesta({ ...datos, editorUrl: null }, 4096)).not.toContain("Ver y editar");
  });

  it("con foto nunca pasa de 1024: acorta la bajada primero", () => {
    const largo = { ...datos, bajada: "Bajada muy larga. ".repeat(100) };
    const html = armarMensajePropuesta(largo, 1024);
    expect(html.length).toBeLessThanOrEqual(1024);
    expect(html).toContain("<b>Una cámara nueva para los que hacen bodas</b>");
    expect(html).toContain("…");
    expect(html).toContain("Ver y editar el borrador");
  });

  it("con una dirección de fuente enorme, deja el nombre sin enlace", () => {
    const html = armarMensajePropuesta({ ...datos, fuenteUrl: `https://ejemplo.com/${"a".repeat(1500)}` }, 1024);
    expect(html.length).toBeLessThanOrEqual(1024);
    expect(html).toContain("Fuente: PetaPixel");
    expect(html).not.toContain("aaaaaaaaaa");
  });
});

describe("textos", () => {
  it("escapa HTML y arma el aviso de fallo", () => {
    expect(escaparHtml('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
    expect(mensajeDeFallo("Claude <tardó>")).toContain("Claude &lt;tardó&gt;");
  });
});
