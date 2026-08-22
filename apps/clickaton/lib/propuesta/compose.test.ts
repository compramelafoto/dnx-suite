/**
 * Ejecutar: pnpm --filter clickaton exec tsx lib/propuesta/compose.test.ts
 */
import assert from "node:assert/strict";
import { register } from "node:module";
import sharp from "sharp";

// `compose.ts` importa el paquete "server-only" (correcto: es código de
// servidor real). Ese paquete resuelve a un no-op solo bajo la condición de
// exports `react-server`, que agrega el bundler de Next. Corriendo este
// archivo suelto con tsx esa condición no existe, así que el import
// lanzaría. Acá registramos un loader mínimo que agrega esa condición para
// TODAS las resoluciones de este proceso, sin tocar compose.ts ni el
// comando con el que se corre esta prueba. El import de "./compose" se hace
// después, en forma dinámica, para que el loader ya esté activo.
register(
  `data:text/javascript,${encodeURIComponent(
    'export async function resolve(s,c,n){return n(s,{...c,conditions:[...c.conditions,"react-server"]});}',
  )}`,
  import.meta.url,
);

/** Logo sintético: cuadrado de color sólido con alfa. */
async function logoDePrueba(rgb: { r: number; g: number; b: number }) {
  return sharp({
    create: {
      width: 400,
      height: 200,
      channels: 4,
      background: { ...rgb, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Logo mayormente transparente con un parche blanco chico en una esquina.
 * Sirve para probar que measureLogo ignora los píxeles transparentes: si los
 * contara, el blanco del parche se diluiría entre el resto (transparente,
 * que sharp devuelve con RGB en 0) y la luminancia media bajaría mucho.
 */
async function logoConParcheTransparente() {
  const ancho = 400;
  const alto = 200;
  const parche = 40;
  const cuadroBlanco = await sharp({
    create: {
      width: parche,
      height: parche,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: ancho,
      height: alto,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: cuadroBlanco, left: 0, top: 0 }])
    .png()
    .toBuffer();
}

async function main() {
  const { composePiece, measureLogo } = await import("./compose");

  // measureLogo
  const claro = await measureLogo(await logoDePrueba({ r: 245, g: 245, b: 245 }));
  assert.ok(claro.meanLuminance > 0.9, "un logo casi blanco debe medir alto");
  assert.equal(claro.hasAlpha, true);

  const oscuro = await measureLogo(await logoDePrueba({ r: 20, g: 20, b: 20 }));
  assert.ok(oscuro.meanLuminance < 0.15, "un logo casi negro debe medir bajo");

  // Los píxeles transparentes no deben contar en el promedio.
  const conTransparencia = await measureLogo(await logoConParcheTransparente());
  assert.ok(
    conTransparencia.meanLuminance > 0.9,
    "el promedio debe reflejar solo el parche blanco visible, no diluirse con los píxeles transparentes",
  );

  // composePiece devuelve un PNG del tamaño pedido
  const png = await composePiece({
    pieceId: "infospot-welcome",
    logo: await logoDePrueba({ r: 30, g: 30, b: 30 }),
    brandName: "Marca de prueba",
    viewport: "desktop",
  });
  const meta = await sharp(png).metadata();
  assert.equal(meta.format, "png");
  assert.equal(meta.width, 1440);
  assert.equal(meta.height, 900);

  const mobile = await composePiece({
    pieceId: "infospot-welcome",
    logo: await logoDePrueba({ r: 30, g: 30, b: 30 }),
    brandName: "Marca de prueba",
    viewport: "mobile",
  });
  const metaMobile = await sharp(mobile).metadata();
  assert.equal(metaMobile.width, 390);
  assert.equal(metaMobile.height, 844);

  // pieza inexistente
  await assert.rejects(
    composePiece({
      pieceId: "no-existe",
      logo: await logoDePrueba({ r: 30, g: 30, b: 30 }),
      brandName: "X",
      viewport: "desktop",
    }),
    /no existe/i,
  );

  console.log("compose: ok");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
