/**
 * Genera los módulos con las tipografías incrustadas en base64.
 *
 * Se ejecuta a mano cuando cambia el catálogo o se actualiza @fontsource, y el resultado se
 * commitea. No es un paso del build a propósito: el build no debería depender de que los
 * paquetes de fuentes estén instalados de una forma particular — que es justamente el problema
 * que esto resuelve.
 *
 *   pnpm --filter @repo/design-studio fuentes
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FONT_CATALOG, FONT_IDS } from "../src/fonts/catalog";

const require = createRequire(import.meta.url);
const destino = join(import.meta.dirname, "..", "src", "fonts", "embedded");
mkdirSync(destino, { recursive: true });

let total = 0;
for (const id of FONT_IDS) {
  const def = FONT_CATALOG[id];
  const slots: string[] = [];
  const yaVisto = new Map<string, string>();

  for (const [slot, archivo] of Object.entries(def.files)) {
    // Las familias de un solo peso repiten archivo: se guarda una vez y los demás lo referencian.
    let constante = yaVisto.get(archivo);
    if (!constante) {
      const bytes = readFileSync(require.resolve(`${def.pkg}/files/${archivo}`));
      constante = `B${yaVisto.size}`;
      yaVisto.set(archivo, constante);
      slots.push(`const ${constante} = "${bytes.toString("base64")}";`);
      total += bytes.length;
    }
  }

  const mapa = Object.entries(def.files)
    .map(([slot, archivo]) => `  ${slot}: ${yaVisto.get(archivo)},`)
    .join("\n");

  writeFileSync(
    join(destino, `${id}.ts`),
    `// Generado por scripts/generar-fuentes-incrustadas.mts. No editar a mano.\n` +
      `${slots.join("\n")}\n\n` +
      `export const FUENTE: Record<string, string> = {\n${mapa}\n};\n`,
  );
}

const indice = FONT_IDS.map(
  (id) => `  ${id}: () => import("./${id}").then((m) => m.FUENTE),`,
).join("\n");
writeFileSync(
  join(destino, "index.ts"),
  `// Generado por scripts/generar-fuentes-incrustadas.mts. No editar a mano.\n` +
    `/** Una familia por módulo: solo se carga la que la pieza usa. */\n` +
    `export const FUENTES_INCRUSTADAS: Record<string, () => Promise<Record<string, string>>> = {\n${indice}\n};\n`,
);

console.log(`${FONT_IDS.length} familias incrustadas · ${Math.round(total / 1024)} KB de fuentes`);
