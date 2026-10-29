/**
 * Genera las plantillas de sistema de los productos que no son libritos: diplomas, calendarios,
 * anuarios, señaladores, portarretratos, tarjetas y pósters del curso.
 *
 * Igual que `generar.ts` (el de los libritos), deja en la carpeta de salida (por defecto
 * `scripts/plantillas-sistema/salida-productos/`):
 * - `fondos/`: los JPG de cada hoja, para subir a R2 en `template-v2/sistema/<archivo>`.
 * - `plantillas.sql`: el SQL idempotente (con `{{OWNER_USER_ID}}` y `{{R2_BASE}}`).
 * - `verificacion/`: cada hoja dibujada con el motor de impresión y datos de muestra, y láminas.
 *
 * No escribe en ninguna base ni sube nada.
 *
 * Correr: `npx tsx scripts/plantillas-sistema/generar-productos.ts [--serie=diplomas] [--solo=<id>,<id>] [--salida=<carpeta>] [--dpi=50] [--sin-verificacion]`
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { PlantillaSistema } from "./definiciones";
import { generarFondos } from "./fondos";
import { generarSql } from "./sql";
import { PRODUCTOS } from "./productos";
import { definirProducto } from "./productos/definir";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k!, v ?? "true"] as const;
  }),
);
const SALIDA = path.resolve(args.get("salida") ?? path.join(__dirname, "salida-productos"));
const SERIE = args.get("serie");
const SOLO = args.get("solo")?.split(",");
const DPI = Number(args.get("dpi") ?? 50);

async function main() {
  const ids = new Set<string>();
  const todas = PRODUCTOS.map(definirProducto);
  for (const p of todas) {
    if (ids.has(p.templateId)) throw new Error(`Id repetido: ${p.templateId}`);
    ids.add(p.templateId);
  }
  const plantillas = todas.filter((p) => (!SERIE || p.modelo.serie === SERIE) && (!SOLO || SOLO.includes(p.templateId)));
  const fondos = path.join(SALIDA, "fondos");
  await mkdir(fondos, { recursive: true });
  for (const p of plantillas) {
    console.log(p.nombre);
    await generarFondos(p, fondos);
  }
  if (!SOLO) {
    await writeFile(path.join(SALIDA, "plantillas.sql"), generarSql(plantillas));
    console.log(`SQL: ${path.join(SALIDA, "plantillas.sql")} (${plantillas.length} plantillas)`);
  }
  if (args.has("sin-verificacion")) return;

  const { dibujarPlantilla } = await import("./previsualizar");
  const verif = path.join(SALIDA, "verificacion");
  await mkdir(verif, { recursive: true });
  const primeras: Array<{ png: Buffer; p: PlantillaSistema }> = [];
  for (const p of plantillas) {
    const { pngs, avisos } = await dibujarPlantilla(p, fondos, DPI);
    for (const [i, png] of pngs.entries()) await writeFile(path.join(verif, `${p.templateId}-hoja-${i + 1}.png`), png);
    if (avisos.length) console.log(`  avisos ${p.templateId}: ${avisos.join(" | ")}`);
    if (p.bindings.some((b) => b.variableKey === "branding.schoolLogoUrl")) {
      const sin = await dibujarPlantilla(p, fondos, DPI, { sinLogo: true });
      await writeFile(path.join(verif, `${p.templateId}-sin-logo.png`), sin.pngs[0]!);
    }
    primeras.push({ png: pngs[0]!, p });
  }
  for (let i = 0, n = 1; i < primeras.length; i += 9, n++) await lamina(primeras.slice(i, i + 9), path.join(verif, `lamina-${n}.jpg`));
  console.log(`Verificación: ${verif}`);
}

/** Las primeras hojas en una grilla de 3 columnas, con el nombre de cada plantilla. */
async function lamina(items: Array<{ png: Buffer; p: PlantillaSistema }>, destino: string) {
  const celda = 760;
  const rotulo = 46;
  const gap = 26;
  const cols = 3;
  const filas = Math.ceil(items.length / cols);
  const compuestos: sharp.OverlayOptions[] = [];
  for (const [i, { png, p }] of items.entries()) {
    const x = gap + (i % cols) * (celda + gap);
    const y = gap + Math.floor(i / cols) * (celda + rotulo + gap);
    const nombre = p.nombre.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    compuestos.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${celda}" height="${rotulo}"><text x="0" y="32" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#222">${nombre}</text></svg>`),
      left: x,
      top: y,
    });
    const img = await sharp(png).resize(celda, celda, { fit: "inside", background: "#e9e9ee" }).toBuffer();
    const meta = await sharp(img).metadata();
    compuestos.push({ input: img, left: x + Math.round((celda - meta.width!) / 2), top: y + rotulo });
  }
  await sharp({ create: { width: gap + cols * (celda + gap), height: gap + filas * (celda + rotulo + gap), channels: 3, background: "#e9e9ee" } })
    .composite(compuestos)
    .jpeg({ quality: 82 })
    .toFile(destino);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
