import { describe, expect, it } from "vitest";
import { readDesignDocument, validateForPublish, type TextMeasurer } from "@repo/design-studio";
import { documentoAEditor, editorADocumento, type EditorBlock } from "./bridge";
import { carnetDesignDocument, CARNET_VARIABLE_CONTRACT } from "./template";

const medidor: TextMeasurer = {
  widthOf: (t, _f, _s, sizePt) => t.length * sizePt * 0.5,
};

/** Le pone id a los bloques, que es lo único que la base agrega al guardar. */
function conIds(blocks: Omit<EditorBlock, "id">[]): EditorBlock[] {
  return blocks.map((b, i) => ({ ...b, id: `b${i}` }));
}

describe("ida y vuelta del diseño de fábrica", () => {
  const semilla = documentoAEditor(carnetDesignDocument());
  const vuelta = editorADocumento({
    canvas: semilla.canvas,
    blocks: conIds(semilla.blocks),
  });

  it("el editor recibe las dos caras con todos los bloques", () => {
    expect(semilla.blocks.filter((b) => b.pageIndex === 0)).toHaveLength(6);
    expect(semilla.blocks.filter((b) => b.pageIndex === 1)).toHaveLength(5);
  });

  it("lo que vuelve del editor sigue siendo un documento válido", () => {
    const r = readDesignDocument(vuelta.document);
    expect(r.ok).toBe(true);
  });

  it("y se puede publicar sin errores", () => {
    const doc = readDesignDocument(vuelta.document);
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    const r = validateForPublish(doc.value, CARNET_VARIABLE_CONTRACT, { measurer: medidor });
    expect(r.errors).toEqual([]);
  });

  it("conserva las medidas del papel", () => {
    const doc = readDesignDocument(vuelta.document);
    if (!doc.ok) throw new Error("no se leyó");
    expect(doc.value.format.width).toBeCloseTo(85.6, 1);
    expect(doc.value.format.height).toBeCloseTo(54, 1);
    expect(doc.value.format.bleedMm).toBe(3);
  });

  it("conserva la posición de cada bloque dentro de un décimo de milímetro", () => {
    const original = readDesignDocument(carnetDesignDocument());
    const final = readDesignDocument(vuelta.document);
    if (!original.ok || !final.ok) throw new Error("no se leyó");

    for (const [i, cara] of original.value.sides.entries()) {
      for (const [j, bloque] of cara.blocks.entries()) {
        const salida = final.value.sides[i]?.blocks[j];
        expect(salida, `falta el bloque ${bloque.id}`).toBeDefined();
        expect(salida!.x).toBeCloseTo(bloque.x, 1);
        expect(salida!.y).toBeCloseTo(bloque.y, 1);
        expect(salida!.width).toBeCloseTo(bloque.width, 1);
        expect(salida!.height).toBeCloseTo(bloque.height, 1);
      }
    }
  });

  it("conserva el cuerpo tipográfico en puntos", () => {
    const original = readDesignDocument(carnetDesignDocument());
    const final = readDesignDocument(vuelta.document);
    if (!original.ok || !final.ok) throw new Error("no se leyó");

    const textos = (d: typeof original.value) =>
      d.sides.flatMap((s) => s.blocks.filter((b) => b.type === "text"));
    const a = textos(original.value);
    const b = textos(final.value);
    expect(b).toHaveLength(a.length);
    a.forEach((bloque, i) => {
      if (bloque.type !== "text" || b[i]?.type !== "text") return;
      expect(b[i].fontSize).toBeCloseTo(bloque.fontSize, 2);
      expect(b[i].fontId).toBe(bloque.fontId);
      expect(b[i].color).toBe(bloque.color);
    });
  });

  it("los marcadores de variable sobreviven el viaje", () => {
    const final = readDesignDocument(vuelta.document);
    if (!final.ok) throw new Error("no se leyó");
    const contenidos = final.value.sides
      .flatMap((s) => s.blocks)
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.content : ""));
    expect(contenidos).toContain("{{institutionName}}");
    expect(contenidos).toContain("{{fullName}}");
    expect(contenidos.some((c) => c.includes("{{memberNumber}}"))).toBe(true);
  });

  it("la foto y el QR mantienen su variable", () => {
    const final = readDesignDocument(vuelta.document);
    if (!final.ok) throw new Error("no se leyó");
    const bloques = final.value.sides.flatMap((s) => s.blocks);
    const foto = bloques.find((b) => b.type === "image");
    const qr = bloques.find((b) => b.type === "qrcode");
    expect(foto?.type === "image" && foto.variableKey).toBe("photo");
    expect(qr?.type === "qrcode" && qr.variableKey).toBe("verificationUrl");
  });

  it("no genera avisos: el diseño de fábrica se traduce entero", () => {
    expect(vuelta.avisos).toEqual([]);
  });
});

describe("editorADocumento", () => {
  const canvas = { width: 1011, height: 638, dpi: 300, bleedMm: 3, safeAreaMm: 3 };
  const bloque = (over: Partial<EditorBlock>): EditorBlock => ({
    id: "x1",
    type: "TEXT",
    pageIndex: 0,
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    rotation: 0,
    zIndex: 0,
    opacity: 1,
    locked: false,
    visible: true,
    configJson: {},
    ...over,
  });

  it("un diseño de una sola cara produce un documento de un solo lado", () => {
    const r = editorADocumento({ canvas, blocks: [bloque({})] });
    const doc = readDesignDocument(r.document);
    expect(doc.ok).toBe(true);
    if (doc.ok) expect(doc.value.sides).toHaveLength(1);
  });

  it("un QR de dirección fija se lleva su propia variable", () => {
    const r = editorADocumento({
      canvas,
      blocks: [
        bloque({
          id: "qr-1",
          type: "QR",
          configJson: { mode: "FIXED", value: "https://sfpr.com.ar" },
        }),
      ],
    });
    expect(r.variablesSinteticas).toHaveLength(1);
    expect(r.variablesSinteticas[0].value).toBe("https://sfpr.com.ar");

    const doc = readDesignDocument(r.document);
    if (!doc.ok) throw new Error("no se leyó");
    const qr = doc.value.sides[0].blocks[0];
    expect(qr.type === "qrcode" && qr.variableKey).toBe(r.variablesSinteticas[0].key);
  });

  it("un QR fijo sin dirección se avisa en vez de imprimir un código vacío", () => {
    const r = editorADocumento({
      canvas,
      blocks: [bloque({ type: "QR", configJson: { mode: "FIXED", value: "  " } })],
    });
    expect(r.variablesSinteticas).toEqual([]);
    expect(r.avisos.join(" ")).toContain("sin dirección");
  });

  it("dos QR fijos no se pisan la variable", () => {
    const r = editorADocumento({
      canvas,
      blocks: [
        bloque({ id: "qr-a", type: "QR", configJson: { mode: "FIXED", value: "https://a.com" } }),
        bloque({ id: "qr-b", type: "QR", configJson: { mode: "FIXED", value: "https://b.com" } }),
      ],
    });
    const claves = r.variablesSinteticas.map((v) => v.key);
    expect(new Set(claves).size).toBe(2);
  });

  it("el zIndex manda el orden de dibujo, no el orden de la lista", () => {
    const r = editorADocumento({
      canvas,
      blocks: [
        bloque({ id: "arriba", zIndex: 10, configJson: { content: "arriba" } }),
        bloque({ id: "abajo", zIndex: 1, configJson: { content: "abajo" } }),
      ],
    });
    const doc = readDesignDocument(r.document);
    if (!doc.ok) throw new Error("no se leyó");
    expect(doc.value.sides[0].blocks.map((b) => b.id)).toEqual(["abajo", "arriba"]);
  });

  it("una tipografía fuera del catálogo no frena la impresión, pero se avisa", () => {
    const r = editorADocumento({
      canvas,
      blocks: [bloque({ configJson: { content: "hola", fontFamily: "Comic Sans MS" } })],
    });
    const doc = readDesignDocument(r.document);
    if (!doc.ok) throw new Error("no se leyó");
    const t = doc.value.sides[0].blocks[0];
    expect(t.type === "text" && t.fontId).toBe("dmSans");
    expect(r.avisos.join(" ")).toContain("Comic Sans MS");
  });

  it("un bloque de dato variable sin variable elegida se avisa", () => {
    const r = editorADocumento({
      canvas,
      blocks: [bloque({ type: "VARIABLE_TEXT", configJson: {} })],
    });
    const doc = readDesignDocument(r.document);
    if (doc.ok) expect(doc.value.sides[0].blocks).toHaveLength(0);
    expect(r.avisos.join(" ")).toContain("sin variable");
  });

  it("un círculo se imprime como rectángulo con el radio al máximo", () => {
    const r = editorADocumento({
      canvas,
      blocks: [
        bloque({ type: "SHAPE", width: 100, height: 100, configJson: { variant: "circle" } }),
      ],
    });
    const doc = readDesignDocument(r.document);
    if (!doc.ok) throw new Error("no se leyó");
    const forma = doc.value.sides[0].blocks[0];
    expect(forma.type).toBe("rect");
    if (forma.type === "rect") expect(forma.cornerRadius).toBeCloseTo(forma.width / 2, 2);
  });

  it("las medidas se derivan del dpi del lienzo, no de una constante", () => {
    const r = editorADocumento({
      canvas: { width: 2022, height: 1276, dpi: 600 },
      blocks: [],
    });
    const doc = readDesignDocument(r.document);
    if (!doc.ok) throw new Error("no se leyó");
    expect(doc.value.format.width).toBeCloseTo(85.6, 1);
  });
});

describe("imágenes atadas a un dato", () => {
  const canvas = { width: 1011, height: 638, dpi: 300 };
  const imagen = (configJson: unknown): EditorBlock => ({
    id: "img", type: "IMAGE", pageIndex: 0, x: 0, y: 0, width: 100, height: 100,
    rotation: 0, zIndex: 0, opacity: 1, locked: false, visible: true, configJson,
  });

  it("lee la variable donde la escribe el editor", () => {
    const r = editorADocumento({
      canvas,
      blocks: [imagen({ source: { variableKey: "photo" }, fit: "cover" })],
    });
    const doc = readDesignDocument(r.document);
    if (!doc.ok) throw new Error("no se leyó");
    const b = doc.value.sides[0].blocks[0];
    expect(b.type === "image" && b.variableKey).toBe("photo");
  });

  it("y también en la raíz, por compatibilidad", () => {
    const r = editorADocumento({ canvas, blocks: [imagen({ variableKey: "institutionLogo" })] });
    const doc = readDesignDocument(r.document);
    if (!doc.ok) throw new Error("no se leyó");
    const b = doc.value.sides[0].blocks[0];
    expect(b.type === "image" && b.variableKey).toBe("institutionLogo");
  });

  it("una imagen con archivo propio sigue usando el archivo", () => {
    const r = editorADocumento({ canvas, blocks: [imagen({ src: "https://cdn/x.png" })] });
    const doc = readDesignDocument(r.document);
    if (!doc.ok) throw new Error("no se leyó");
    const b = doc.value.sides[0].blocks[0];
    expect(b.type === "image" && b.resourceRef).toBe("https://cdn/x.png");
  });
});
