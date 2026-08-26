/**
 * Emite un carnet de ejemplo con el fixture congelado. No es parte del paquete: sirve para
 * mirar el resultado con los ojos, que es la única prueba que las pruebas automáticas no hacen.
 *
 *   pnpm --filter @repo/design-studio exec tsx src/emitir-ejemplo.ts <directorio-salida>
 */
import { readFileSync } from "node:fs";
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

const foto = new Uint8Array(readFileSync("/tmp/foto-ejemplo.png"));
const recursos: ResourceResolver = { read: async () => foto };

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
