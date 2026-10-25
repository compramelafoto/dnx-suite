import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { CLICKATON_WELCOME_STORY_V1 } from "./templates/clickaton-welcome-story";
import { renderComposition } from "./render";

/**
 * En el servidor no hay ninguna tipografía instalada.
 *
 * La placa pedía "Arial, Helvetica, sans-serif" y librsvg, al no encontrar ninguna, no dibujaba
 * los textos: salían la franja y la foto, y ni una palabra. Después se incrustó DM Sans con un
 * `@font-face`, pero librsvg lo ignora y en una Mac escribía igual con Helvetica: el test de
 * píxeles pasaba acá y en el servidor seguía sin texto.
 *
 * El test que captura el requisito es el segundo: en el dibujo no puede haber ni un `<text>`,
 * porque cualquier `<text>` depende de las fuentes de la máquina. El primero no puede fallar en
 * una computadora de trabajo y está para lo otro: comprobar que los trazos se ven.
 */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5/hPwAIAgL/4d1j8wAAAABJRU5ErkJggg==",
  "base64",
);

async function pixelesClaros(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let claros = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i]! > 200 && data[i + 1]! > 200 && data[i + 2]! > 200) claros++;
  }
  return claros;
}

test("los textos se ven en la placa", async () => {
  const salida = await renderComposition({
    template: CLICKATON_WELCOME_STORY_V1,
    variables: {
      participantName: "María Belén Fernández",
      instagram: "mbfernandez",
      participantNumber: "CKA26-00023",
      city: "Rosario",
      province: "Santa Fe",
      editionName: "Clickatón Rosario",
      editionDate: "19/09/2026",
    },
    assets: { photo: PIXEL_PNG },
    crop: { cropX: 0, cropY: 0, zoom: 1, rotation: 0, strategy: "CENTER", boundingBox: null },
  });

  const claros = await pixelesClaros(salida.png);
  assert.ok(
    claros > 8_000,
    `se esperaban miles de píxeles de texto claro y hubo ${claros}: los textos no se dibujaron`,
  );
});

test("el dibujo no tiene ningún <text>: las letras viajan en trazos", async () => {
  const { buildTextSvgParaTest } = await import("./render");
  const svg = await buildTextSvgParaTest(CLICKATON_WELCOME_STORY_V1, {
    participantName: "María Belén Fernández",
    instagram: "mbfernandez",
    participantNumber: "CKA26-00023",
    city: "Rosario",
    province: "Santa Fe",
    editionName: "Clickatón Rosario",
    editionDate: "19/09/2026",
  });

  assert.doesNotMatch(svg, /<text/i, "un <text> depende de las fuentes de la máquina: en el servidor no sale");
  assert.doesNotMatch(svg, /font-family|@font-face/, "librsvg ignora @font-face; las letras van en trazos");
  assert.match(svg, /<path /, "los textos tienen que estar dibujados como trazos");
});
