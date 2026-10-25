import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { buildTiledWatermarkSvg } from "@/lib/watermarking";
import { buildProtectedPreviewWatermarkSvg } from "@/lib/images/protected-preview-watermark";

/**
 * Las marcas de agua no pueden depender de las tipografías del servidor.
 *
 * Con `<text>` y un `@font-face` incrustado, librsvg buscaba la letra en el sistema; en Vercel no
 * hay ninguna y cada letra salía como un cuadradito ("□□□□") sobre las fotos del canje. Ahora el
 * texto va como trazos (`<path>`) y se dibuja igual en cualquier lado.
 */
test("la marca de agua en mosaico no usa <text> y dibuja letras", async () => {
  const svg = buildTiledWatermarkSvg({
    width: 800,
    height: 600,
    text: "Compramelafoto.com - Fotoffice.com",
    opacity: 0.5,
    fontSize: 24,
    centerText: "Cecilia Donnelly",
  }).toString("utf8");
  assert.ok(!svg.includes("<text"), "sigue usando <text>");
  assert.ok(!svg.includes("@font-face"), "sigue incrustando la fuente");
  assert.ok((svg.match(/<path d="M/g) ?? []).length > 3, "no hay trazos de letras");
  const { data } = await sharp(Buffer.from(svg)).flatten({ background: "#808080" }).raw().toBuffer({ resolveWithObject: true });
  let claros = 0;
  for (let i = 0; i < data.length; i += 3) if (data[i]! > 200) claros++;
  assert.ok(claros > 500, "las letras no se dibujaron");
});

test("la vista previa protegida tampoco usa <text>", () => {
  const svg = buildProtectedPreviewWatermarkSvg({ width: 900, height: 600, mode: "strong", photoId: 123 }).toString("utf8");
  assert.ok(!svg.includes("<text"));
  assert.ok(svg.includes("<path d=\"M"));
});
