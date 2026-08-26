/**
 * Emite un carnet de ejemplo con el fixture congelado. No es parte del paquete: sirve para
 * mirar el resultado con los ojos, que es la única prueba que las pruebas automáticas no hacen.
 *
 *   pnpm --filter @repo/design-studio exec tsx src/emitir-ejemplo.ts <directorio-salida>
 */
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { emitDesign } from "./export/emit";
import type { VariableContract } from "./variables/contract";
import type { ResourceResolver } from "./render/resources";

const salidaDir = process.argv[2] ?? ".";

const documento = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("./document/__fixtures__/carnet-v1.json", import.meta.url)),
    "utf8",
  ),
) as unknown;

const recursos: ResourceResolver = { read: async () => retratoDePrueba() };

/**
 * Un PNG de degradado, generado acá para que el script no dependa de ningún archivo suelto.
 * Ocupa el lugar del retrato del socio.
 */
function retratoDePrueba(): Uint8Array {
  const ANCHO = 300;
  const ALTO = 400;
  const crudo = Buffer.alloc((ANCHO * 3 + 1) * ALTO);
  let p = 0;
  for (let y = 0; y < ALTO; y++) {
    crudo[p++] = 0; // filtro de la fila
    for (let x = 0; x < ANCHO; x++) {
      const t = (x / ANCHO + y / ALTO) / 2;
      crudo[p++] = Math.round(40 + t * 120);
      crudo[p++] = Math.round(90 + t * 110);
      crudo[p++] = Math.round(90 + t * 100);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ANCHO, 0);
  ihdr.writeUInt32BE(ALTO, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // color verdadero, sin alfa
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      trozoPng("IHDR", ihdr),
      trozoPng("IDAT", deflateSync(crudo)),
      trozoPng("IEND", Buffer.alloc(0)),
    ]),
  );
}

function trozoPng(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const suma = Buffer.alloc(4);
  suma.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, suma]);
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    let c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const contrato: VariableContract = {
  variables: [
    { key: "fullName", type: "text", label: "Nombre completo", required: true, sampleValue: "Daniel Cuart", maxLength: 34 },
    { key: "memberNumber", type: "number", label: "Número de socio", required: true, sampleValue: "128", decimals: 0 },
    { key: "category", type: "text", label: "Categoría", required: false, sampleValue: "Socio activo" },
    { key: "validUntil", type: "date", label: "Vigente hasta", required: true, sampleValue: "2028-08-26", dateFormat: "es-AR-short" },
    { key: "verificationUrl", type: "qrPayload", label: "Enlace de verificación", required: true, sampleValue: "https://fotoffice.com/c/AB12CD34" },
    { key: "photo", type: "image", label: "Foto del socio", required: true, sampleValue: "socios/ejemplo/foto.png" },
  ],
};

const salida = await emitDesign({
  document: documento,
  contract: contrato,
  values: {
    fullName: "Daniel Cuart",
    memberNumber: 128,
    category: "Socio activo",
    validUntil: new Date(Date.UTC(2028, 7, 26)),
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
    photo: "socios/128/foto.png",
  },
  formats: ["PDF", "PNG_PER_SIDE"],
  includeBleed: true,
  pngDpi: 300,
  resources: recursos,
  fileBaseName: "carnet-sfpr-128",
});

if (!salida.ok) {
  console.error("NO SE EMITIÓ:");
  for (const e of salida.errors) console.error(" -", e);
  process.exit(1);
}

for (const f of salida.files) {
  await writeFile(`${salidaDir}/${f.name}`, f.bytes);
  console.log(
    `${f.name.padEnd(28)} ${(f.bytes.byteLength / 1024).toFixed(0).padStart(5)} kB  sha256:${f.checksum.slice(0, 12)}…`,
  );
}
console.log(`\nrenderizador ${salida.rendererVersion} · esquema ${salida.schemaVersion}`);
console.log(
  `omitidas: ${salida.omittedVariables.length === 0 ? "ninguna" : salida.omittedVariables.join(", ")}`,
);
