import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { capaDeTexto, tituloQueEntra } from "./texto";

const visibles = async (png: Buffer) => {
  const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]! > 32) n++;
  return n;
};

describe("capas de texto con la fuente del repo", () => {
  it("dibuja tildes y ñ, en blanco, con píxeles visibles", async () => {
    const c = await capaDeTexto({ texto: "Inauguración — ñandú", tamano: 64, peso: "negrita", color: "#ffffff", ancho: 900 });
    expect(c.width).toBeGreaterThan(300);
    expect(await visibles(c.input)).toBeGreaterThan(2000);
  });
  it("parte en líneas al ancho y crece en alto", async () => {
    const una = await capaDeTexto({ texto: "Rosario", tamano: 60, peso: "normal", color: "#fff", ancho: 600 });
    const varias = await capaDeTexto({ texto: "Una línea muy larga que tiene que partirse en varias líneas para entrar", tamano: 60, peso: "normal", color: "#fff", ancho: 600 });
    expect(varias.width).toBeLessThanOrEqual(600);
    expect(varias.height).toBeGreaterThan(una.height * 2);
  });
  it("la negrita es más ancha que la normal", async () => {
    const n = await capaDeTexto({ texto: "Inaugura", tamano: 80, peso: "normal", color: "#fff", ancho: 1000 });
    const b = await capaDeTexto({ texto: "Inaugura", tamano: 80, peso: "negrita", color: "#fff", ancho: 1000 });
    expect(b.width).toBeGreaterThan(n.width);
  });
  it("escapa el markup de Pango", async () => {
    await expect(capaDeTexto({ texto: "B&N <2026>", tamano: 40, peso: "normal", color: "#fff", ancho: 600 })).resolves.toBeTruthy();
  });
  it("título: prueba tamaños de mayor a menor hasta entrar; si no, corta con …", async () => {
    const corto = await tituloQueEntra("Silos", [84, 72, 62], 900, 300, "#fff");
    expect(corto.tamano).toBe(84);
    const largo = await tituloQueEntra("x ".repeat(300), [84, 72, 62], 900, 300, "#fff");
    expect(largo.tamano).toBe(62);
    expect(largo.capa.height).toBeLessThanOrEqual(300);
  });
  it("dibuja con Roboto del repo y no con una fuente del sistema (medida propia de Roboto)", async () => {
    // Con Roboto, "Silos del puerto Rgay" a 80 px mide 740 px de ancho; Helvetica (la de macOS por
    // CoreText) da 753 y la de reemplazo de fontconfig, 830.
    expect(process.env.PANGOCAIRO_BACKEND).toBe("fc");
    const c = await capaDeTexto({ texto: "Silos del puerto Rgay", tamano: 80, peso: "normal", color: "#fff", ancho: 1000 });
    expect(c.width).toBeGreaterThanOrEqual(736);
    expect(c.width).toBeLessThanOrEqual(744);
  });
  it("texto vacío: error (nunca una pieza sin texto)", async () => {
    await expect(capaDeTexto({ texto: "   ", tamano: 40, peso: "normal", color: "#fff", ancho: 600 })).rejects.toThrow();
  });
  it("texto que la fuente no puede dibujar (sólo espacios raros): error", async () => {
    await expect(capaDeTexto({ texto: "​​", tamano: 40, peso: "normal", color: "#fff", ancho: 600 })).rejects.toThrow();
  });
});
