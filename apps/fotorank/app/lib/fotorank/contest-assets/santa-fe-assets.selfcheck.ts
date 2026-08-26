/**
 * Selfcheck — assets del hero de Santa Fe en Foco.
 *   pnpm --filter fotorank run test:santa-fe-assets
 *
 * Prueba de regresión de 615df551: el header de SFEF desapareció en producción
 * porque el manifiesto quedó con `file: null` (fallback tipográfico) y los JPG
 * nunca llegaron a la rama desplegada. Esta prueba fija las dos mitades del
 * contrato: el manifiesto apunta a los archivos correctos Y los archivos existen
 * en disco. No usa snapshots: verifica rutas reales y presencia en el FS.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SANTA_FE_EN_FOCO_ASSETS_SLUG,
  SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST,
} from "./santa-fe-en-foco-assets";
import { isSantaFeEnFocoSlug } from "../contest-visual/santa-fe-en-foco";

const HERE = dirname(fileURLToPath(import.meta.url));
/** app/lib/fotorank/contest-assets -> apps/fotorank/public/contest-assets/<slug> */
const PUBLIC_DIR = join(HERE, "../../../../public/contest-assets", SANTA_FE_EN_FOCO_ASSETS_SLUG);

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
}

const hero = SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST.hero;

// 1) El manifiesto apunta al archivo desktop correcto (no null = sin fallback).
ok(
  hero.desktop.file === "hero/hero-desktop.jpg",
  'manifiesto SFEF desktop apunta a "hero/hero-desktop.jpg"',
);

// 2) Ídem mobile.
ok(
  hero.mobile.file === "hero/hero-mobile.jpg",
  'manifiesto SFEF mobile apunta a "hero/hero-mobile.jpg"',
);

// 3-4) Los archivos existen realmente en public/ y no están vacíos.
//      Sin esto, el manifiesto apuntaría a un 404 y el hero quedaría en blanco.
for (const [label, rel] of [
  ["desktop", hero.desktop.file],
  ["mobile", hero.mobile.file],
] as const) {
  const abs = join(PUBLIC_DIR, rel!);
  ok(existsSync(abs), `el archivo ${label} existe en public/ (${rel})`);
  ok(statSync(abs).size > 1024, `el archivo ${label} no está vacío/truncado`);
}

// 5) Ambos tienen alt no vacío (accesibilidad, y evita alt="undefined").
ok(
  Boolean(hero.desktop.alt?.trim()) && Boolean(hero.mobile.alt?.trim()),
  "desktop y mobile tienen texto alternativo no vacío",
);

// 6) El resolver de SFEF NO aplica a otros concursos: el branding no debe
//    filtrarse a Casamar ni a ningún otro slug.
for (const otro of ["casamar", "concurso-prueba", "santafe", "en-foco", ""]) {
  ok(
    isSantaFeEnFocoSlug(otro) === false,
    `isSantaFeEnFocoSlug("${otro}") === false (no aplica branding SFEF)`,
  );
}

// 7) Sí aplica al slug canónico y tolera mayúsculas/espacios.
for (const propio of ["santa-fe-en-foco", "  Santa-Fe-En-Foco  "]) {
  ok(
    isSantaFeEnFocoSlug(propio) === true,
    `isSantaFeEnFocoSlug("${propio.trim()}") === true`,
  );
}

// 8) Fallback preservado: un asset con `file: null` sigue siendo válido para
//    concursos sin material propio (el hero cae al modo tipográfico).
ok(
  SANTA_FE_EN_FOCO_LOCAL_ASSETS_MANIFEST.social.file === null,
  "un asset sin material (social) sigue en null → fallback tipográfico intacto",
);

console.log("FINAL: PASS");
