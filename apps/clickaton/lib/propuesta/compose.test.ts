/**
 * Ejecutar: pnpm --filter clickaton exec tsx lib/propuesta/compose.test.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

/**
 * Logo que dispara la rama de colapso de `trimSeguro`: un lienzo grande de
 * color uniforme con una marca de pocos píxeles centrada. `trim()` recorta
 * al bounding box de la marca (3×3), muy por debajo del mínimo aceptado, así
 * que `trimSeguro` debe descartar el recorte y devolver el logo original.
 */
async function logoQueColapsa() {
  const marca = await sharp({
    create: {
      width: 3,
      height: 3,
      channels: 4,
      background: { r: 10, g: 10, b: 10, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: 400,
      height: 200,
      channels: 4,
      background: { r: 200, g: 200, b: 200, alpha: 1 },
    },
  })
    .composite([{ input: marca, left: 198, top: 98 }])
    .png()
    .toBuffer();
}

/**
 * Logo que dispara la rama de excepción de `trimSeguro`: una imagen de
 * 1×1 píxel. `trim()` lanza porque necesita al menos 3×3 para operar, así
 * que `trimSeguro` debe atrapar la excepción y devolver el logo original.
 */
async function logoDeUnPixel() {
  return sharp({
    create: {
      width: 1,
      height: 1,
      channels: 4,
      background: { r: 50, g: 50, b: 50, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Logo que colapsa en un solo eje: un lienzo blanco grande con una franja
 * negra angosta (200×3). `trim()` recorta al bounding box de la franja
 * (ancho ≥ 8, alto < 8): sirve para distinguir `&&` (correcto, el guardado
 * debe activarse porque el alto falla) de `||` (bug, activaría igual porque
 * el ancho solo ya alcanza). Si el guardado no se activa, la franja
 * estirada tapa el lugar donde debería verse el blanco del lienzo original.
 */
async function logoFranjaColapsante() {
  const franja = await sharp({
    create: {
      width: 200,
      height: 3,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: 400,
      height: 200,
      channels: 4,
      background: { r: 250, g: 250, b: 250, alpha: 1 },
    },
  })
    .composite([{ input: franja, left: 100, top: 98 }])
    .png()
    .toBuffer();
}

/** Logo sin canal alfa (JPEG): trae su propio fondo. */
async function logoSinAlfa() {
  return sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 100, g: 120, b: 140 },
    },
  })
    .jpeg()
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

  // Un logo sin canal alfa trae su propio fondo.
  const sinAlfa = await measureLogo(await logoSinAlfa());
  assert.equal(sinAlfa.hasAlpha, false);

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

  // trimSeguro: rama de colapso (trim() devuelve una imagen < 8px de lado).
  const conColapso = await composePiece({
    pieceId: "infospot-welcome",
    logo: await logoQueColapsa(),
    brandName: "Marca de prueba",
    viewport: "desktop",
  });
  const metaColapso = await sharp(conColapso).metadata();
  assert.equal(metaColapso.format, "png");
  assert.equal(metaColapso.width, 1440);
  assert.equal(metaColapso.height, 900);

  // trimSeguro: el guardado debe activarse aunque un solo eje colapse.
  // Si "&&" se reemplaza por "||", el guardado no se activa acá (el ancho ya
  // alcanza los 8px) y la franja recortada, estirada, tapa la zona donde
  // debería verse el blanco del lienzo original.
  const conColapsoAsimetrico = await composePiece({
    pieceId: "infospot-welcome",
    logo: await logoFranjaColapsante(),
    brandName: "Marca de prueba",
    viewport: "desktop",
  });
  const { data: pixelesAsimetrico, info: infoAsimetrico } = await sharp(conColapsoAsimetrico)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Punto dentro del área donde cae el logo compuesto, pero fuera de la
  // franja: con el guardado activo debe verse el blanco del lienzo
  // original; si no se activó, se ve el gris oscuro de la placa.
  const puntoX = 720;
  const puntoY = 417;
  const idxAsimetrico = (puntoY * infoAsimetrico.width + puntoX) * infoAsimetrico.channels;
  assert.ok(
    pixelesAsimetrico[idxAsimetrico]! > 200 &&
      pixelesAsimetrico[idxAsimetrico + 1]! > 200 &&
      pixelesAsimetrico[idxAsimetrico + 2]! > 200,
    "el guardado de trimSeguro debe activarse aunque un solo eje del recorte colapse",
  );

  // trimSeguro: rama de excepción (trim() lanza sobre una imagen de 1×1).
  const conExcepcion = await composePiece({
    pieceId: "infospot-welcome",
    logo: await logoDeUnPixel(),
    brandName: "Marca de prueba",
    viewport: "desktop",
  });
  const metaExcepcion = await sharp(conExcepcion).metadata();
  assert.equal(metaExcepcion.format, "png");
  assert.equal(metaExcepcion.width, 1440);
  assert.equal(metaExcepcion.height, 900);

  // Cada formato se compone distinto.
  //
  // Las tres piezas de InfoSpot comparten el mismo fondo, pero son formatos
  // publicitarios distintos: una placa centrada, una franja horizontal y un
  // renglón de logos al pie. No pueden dar la misma imagen.
  //
  // Esta prueba existe porque faltaba: `composePiece` usaba la pieza
  // únicamente para elegir el archivo de fondo, así que las nueve piezas del
  // catálogo producían cuatro imágenes —una por plataforma— y el vendedor le
  // mostraba al cliente la misma placa tres veces con distinto epígrafe.
  const logoCompartido = await logoDePrueba({ r: 30, g: 30, b: 30 });
  const mismaPlataformaDistintoFormato = [
    "infospot-welcome",
    "infospot-banner",
    "infospot-marquee",
  ];

  for (const viewport of ["desktop", "mobile"] as const) {
    const compuestas = await Promise.all(
      mismaPlataformaDistintoFormato.map((pieceId) =>
        composePiece({ pieceId, logo: logoCompartido, brandName: "Marca de prueba", viewport }),
      ),
    );
    const huellas = compuestas.map((png) => createHash("sha256").update(png).digest("hex"));
    assert.equal(
      new Set(huellas).size,
      mismaPlataformaDistintoFormato.length,
      `en ${viewport}, cada formato debe dar una imagen distinta (placa ≠ banner ≠ franja)`,
    );
  }

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
