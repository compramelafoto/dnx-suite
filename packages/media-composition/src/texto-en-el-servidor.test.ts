import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { CLICKATON_WELCOME_STORY_V1 } from "./templates/clickaton-welcome-story";
import { renderComposition } from "./render";

/**
 * En el servidor no hay ninguna tipografía instalada.
 *
 * La placa pedía "Arial, Helvetica, sans-serif" y librsvg, al no encontrar ninguna, no dibujaba
 * los textos: salían la franja y la foto, y ni una palabra. En una computadora de trabajo Arial
 * existe, así que el fallo sólo aparecía en producción — y estuvo un mes y medio sin verse
 * porque la vista previa del panel también estaba rota.
 *
 * El test que captura el requisito es el segundo: la tipografía tiene que viajar **dentro** del
 * dibujo. El primero no puede fallar en una computadora de trabajo —acá Arial existe— y está
 * para lo otro: comprobar que declarar la tipografía incrustada no rompe el dibujo del texto.
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

test("el texto sigue dibujándose con la tipografía incrustada", async () => {
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

test("el dibujo declara la tipografía que lleva adentro, y no la pide al sistema", async () => {
  const { buildTextSvgParaTest } = await import("./render");
  const svg = await buildTextSvgParaTest(CLICKATON_WELCOME_STORY_V1, {
    participantName: "Ana",
  });

  assert.match(svg, /@font-face/, "sin @font-face depende de lo que el servidor tenga instalado");
  assert.match(svg, /base64,/, "la tipografía tiene que viajar dentro del dibujo");
  assert.ok(!/font-family="Arial/.test(svg), "Arial no existe en el servidor");
});
