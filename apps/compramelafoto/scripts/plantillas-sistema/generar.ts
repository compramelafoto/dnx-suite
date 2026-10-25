/**
 * Genera las plantillas de sistema «librito 30×20 cm» para la venta escolar.
 *
 * Produce, en la carpeta de salida (por defecto `scripts/plantillas-sistema/salida/`):
 * - `fondos/`: los fondos JPG de cada plantilla (exterior e interior), con nombres estables.
 *   Se suben a R2 en `template-v2/sistema/<archivo>`.
 * - `plantillas.sql`: el SQL idempotente que las carga (ver `sql.ts` por los marcadores).
 * - `verificacion/` (salvo con `--sin-verificacion`): cada página dibujada con el motor de
 *   impresión y fotos de muestra, más dos láminas: todas las tapas y todos los interiores.
 *
 * No escribe en ninguna base ni sube nada.
 *
 * Correr: `npx tsx scripts/plantillas-sistema/generar.ts [--salida=<carpeta>] [--desde=11 --hasta=20] [--solo=<slug>,<slug>] [--serie=<nombre>] [--dpi=60]`
 * (`--desde`/`--hasta` dejan en el SQL sólo esos modelos; `--solo` no escribe SQL)
 * Con `--serie` se generan sólo los modelos de esa tanda (por ejemplo `variadas`, 21–40), y el SQL lleva sólo esos.
 * (la verificación baja las tipografías de Google: necesita red).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { todasLasPlantillas, type PlantillaSistema } from "./definiciones";
import { generarSql } from "./sql";
import { ALTO, ANCHO } from "./lienzo";
import { MODELOS } from "./modelos";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k!, v ?? "true"] as const;
  }),
);
const SALIDA = path.resolve(args.get("salida") ?? path.join(__dirname, "salida"));
const SOLO = args.get("solo")?.split(",");
/** `--desde=11 --hasta=20`: sólo esos modelos (números de la lista), y el SQL con sólo esos. */
const DESDE = args.has("desde") ? Number(args.get("desde")) : undefined;
const HASTA = args.has("hasta") ? Number(args.get("hasta")) : undefined;
const SERIE = args.get("serie");
/** Cuántas plantillas por lámina de verificación (en grilla de 2 columnas). */
const POR_LAMINA = Number(args.get("por-lamina") ?? 6);
const DPI_VERIFICACION = Number(args.get("dpi") ?? 60);
const LIMITE_FONDO = 1.5 * 1024 * 1024;

/**
 * Dibujar un fondo con texturas lleva hasta un minuto. Si el SVG no cambió desde la última vez
 * (misma huella), se deja el JPG que ya está: el resultado sería idéntico.
 */
async function generarFondos(p: PlantillaSistema, carpeta: string) {
  for (const f of p.fondos) {
    const fuente = f.svg();
    const huella = createHash("sha1").update(fuente).digest("hex");
    const archivoHuella = path.join(carpeta, ".huellas", `${f.archivo}.sha1`);
    const anterior = await readFile(archivoHuella, "utf8").catch(() => "");
    if (anterior === huella && (await stat(path.join(carpeta, f.archivo)).catch(() => null))) {
      console.log(`  ${f.archivo}: sin cambios`);
      continue;
    }
    let calidad = 86;
    let jpg: Buffer;
    const png = await sharp(Buffer.from(fuente), { limitInputPixels: false }).resize(ANCHO, ALTO).png().toBuffer();
    do {
      jpg = await sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality: calidad, mozjpeg: true }).toBuffer();
      calidad -= 4;
    } while (jpg.length > LIMITE_FONDO && calidad > 60);
    await writeFile(path.join(carpeta, f.archivo), jpg);
    await mkdir(path.dirname(archivoHuella), { recursive: true });
    await writeFile(archivoHuella, huella);
    console.log(`  ${f.archivo}: ${(jpg.length / 1024).toFixed(0)} KB (calidad ${calidad + 4})`);
  }
}

async function main() {
  const plantillas = todasLasPlantillas({ desde: DESDE, hasta: HASTA }).filter(
    (p) => (!SOLO || SOLO.includes(p.modelo.slug)) && (!SERIE || p.modelo.serie === SERIE),
  );
  const fondos = path.join(SALIDA, "fondos");
  await mkdir(fondos, { recursive: true });

  for (const p of plantillas) {
    console.log(`${p.nombre}`);
    await generarFondos(p, fondos);
  }

  if (!SOLO) {
    await writeFile(path.join(SALIDA, "plantillas.sql"), generarSql(plantillas));
    console.log(`SQL: ${path.join(SALIDA, "plantillas.sql")}`);
  }

  if (args.has("sin-verificacion")) return;

  const { dibujarPlantilla } = await import("./previsualizar");
  const verif = path.join(SALIDA, "verificacion");
  await mkdir(verif, { recursive: true });
  const tapas: Buffer[] = [];
  const interiores: Buffer[] = [];
  for (const p of plantillas) {
    const { pngs, avisos } = await dibujarPlantilla(p, fondos, DPI_VERIFICACION);
    for (const [i, png] of pngs.entries()) {
      await writeFile(path.join(verif, `${p.modelo.slug}-${["exterior", "interior", "plancha"][i] ?? `cara-${i + 1}`}.png`), png);
    }
    if (avisos.length) console.log(`  avisos ${p.modelo.slug}: ${avisos.join(" | ")}`);
    // Con logo del colegio, también cómo queda si el colegio no lo cargó (el bloque no se dibuja).
    if (p.bindings.some((b) => b.variableKey === "branding.schoolLogoUrl")) {
      const sin = await dibujarPlantilla(p, fondos, DPI_VERIFICACION, { sinLogo: true });
      await writeFile(path.join(verif, `${p.modelo.slug}-exterior-sin-logo.png`), sin.pngs[0]!);
    }
    tapas.push(pngs[0]!);
    interiores.push(pngs[1]!);
  }
  for (let i = 0, n = 1; i < plantillas.length; i += POR_LAMINA, n++) {
    const sufijo = plantillas.length > POR_LAMINA ? `-${n}` : "";
    const tanda = plantillas.slice(i, i + POR_LAMINA);
    await lamina(tapas.slice(i, i + POR_LAMINA), tanda, path.join(verif, `lamina-exteriores${sufijo}.jpg`));
    await lamina(interiores.slice(i, i + POR_LAMINA), tanda, path.join(verif, `lamina-interiores${sufijo}.jpg`));
  }
  // Los apaisados, además, como se leen: cada cara enderezada como la pone el visor 3D.
  const apaisados = plantillas.flatMap((p, i) =>
    p.modelo.filtros?.orientacion === "horizontal" ? [{ p, exterior: tapas[i]!, interior: interiores[i]! }] : [],
  );
  for (let i = 0, n = 1; i < apaisados.length; i += 3, n++) {
    const { laminaEnderezada } = await import("./enderezar");
    const sufijo = apaisados.length > 3 ? `-${n}` : "";
    await laminaEnderezada(apaisados.slice(i, i + 3), path.join(verif, `lamina-apaisados-enderezados${sufijo}.jpg`));
  }
  console.log(`Verificación: ${verif}`);
}

/** Junta las páginas en una grilla de 2 columnas con el nombre de cada plantilla. */
async function lamina(pngs: Buffer[], plantillas: PlantillaSistema[], destino: string) {
  const w = 900;
  const h = Math.round((w * ALTO) / ANCHO);
  const rotulo = 50;
  const cols = 2;
  const filas = Math.ceil(pngs.length / cols);
  const gap = 30;
  const compuestos: sharp.OverlayOptions[] = [];
  for (const [i, png] of pngs.entries()) {
    const x = gap + (i % cols) * (w + gap);
    const y = gap + Math.floor(i / cols) * (h + rotulo + gap);
    const nombre = plantillas[i]!.nombre.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    compuestos.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${rotulo}"><text x="0" y="34" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#222">${MODELOS.indexOf(plantillas[i]!.modelo) + 1}. ${nombre}</text></svg>`),
      left: x,
      top: y,
    });
    compuestos.push({ input: await sharp(png).resize(w, h).toBuffer(), left: x, top: y + rotulo });
    // Línea del pliegue, sólo en la lámina.
    compuestos.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2" height="${h}"><rect width="2" height="${h}" fill="#ff0000" opacity="0.35"/></svg>`),
      left: x + Math.round(w / 2) - 1,
      top: y + rotulo,
    });
  }
  await sharp({
    create: { width: gap + cols * (w + gap), height: gap + filas * (h + rotulo + gap), channels: 3, background: "#e9e9ee" },
  })
    .composite(compuestos)
    .jpeg({ quality: 85 })
    .toFile(destino);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
