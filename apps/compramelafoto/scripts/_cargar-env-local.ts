import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Carga `apps/compramelafoto/.env.local` como efecto de importación.
 *
 * Tiene que ser un módulo aparte e importarse ANTES que cualquier cosa que lea el entorno:
 * los `import` de ES se evalúan todos antes del código del archivo, así que un cargador escrito
 * dentro del script correría después de que Prisma ya leyó `DATABASE_URL`.
 *
 * No pisa lo que venga del comando, así se puede sobreescribir cualquier variable al invocar.
 */
function cargar(): void {
  const candidatos = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "apps/compramelafoto/.env.local"),
    resolve(import.meta.dirname ?? __dirname, "../.env.local"),
  ];
  const archivo = candidatos.find((ruta) => existsSync(ruta));
  if (!archivo) return;

  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(linea);
    if (!m) continue;
    let valor = m[2].trim();
    if (valor.startsWith('"') && valor.endsWith('"')) valor = valor.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = valor;
  }
}

cargar();
