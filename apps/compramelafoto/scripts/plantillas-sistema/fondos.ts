/** Dibuja los fondos JPG de una plantilla de sistema (libritos y demás productos). */
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { PlantillaSistema } from "./definiciones";
import { ALTO, ANCHO } from "./lienzo";

const LIMITE_FONDO = 1.5 * 1024 * 1024;

/**
 * Dibujar un fondo con texturas lleva hasta un minuto. Si el SVG no cambió desde la última vez
 * (misma huella), se deja el JPG que ya está: el resultado sería idéntico.
 */
export async function generarFondos(p: PlantillaSistema, carpeta: string) {
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
    const png = await sharp(Buffer.from(fuente), { limitInputPixels: false }).resize(p.tamFondo?.w ?? ANCHO, p.tamFondo?.h ?? ALTO).png().toBuffer();
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

