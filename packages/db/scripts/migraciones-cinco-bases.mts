/**
 * Pone al día las cinco bases de Neon con las migraciones del repo.
 *
 * Las cinco aplicaciones comparten `schema.prisma`, y ningún build corre
 * `prisma migrate deploy`: cada migración se aplica a mano en las cinco y se
 * anota en `_prisma_migrations`. Si una tabla existe en una base y no en otra,
 * las escrituras de la que no la tiene se rompen. Este script hace eso mismo,
 * base por base, sin saltearse nada.
 *
 * Las URLs van en un JSON FUERA del repo, para que no terminen en un commit ni
 * en el historial de la terminal:
 *
 *   {
 *     "fotoffice (rama development)": "postgresql://…",
 *     "compramelafoto (rama production)": "postgresql://…",
 *     …
 *   }
 *
 * Uso, desde packages/db:
 *
 *   # Solo mira. No escribe nada.
 *   pnpm exec tsx scripts/migraciones-cinco-bases.mts --bases ~/neon-bases.json
 *
 *   # Aplica lo pendiente. Pide escribir el nombre de cada base antes de tocarla.
 *   pnpm exec tsx scripts/migraciones-cinco-bases.mts --bases ~/neon-bases.json --aplicar
 *
 *   # Limita a ciertas migraciones (separadas por coma).
 *   … --aplicar --solo 20260911000000_sorteos,20260913000000_cash_and_clients
 *
 * Cada migración se manda junto con su fila de `_prisma_migrations` en un solo
 * comando: Postgres lo corre como una transacción, así que o queda todo o no
 * queda nada. Ante el primer error se detiene y no sigue con ninguna otra base.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

type Fila = {
  migration_name: string;
  checksum: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

type Estado = {
  pendientes: string[];
  checksumDistinto: string[];
  trabadas: string[];
  soloEnBase: string[];
};

const AQUI = dirname(fileURLToPath(import.meta.url));
const PAQUETE_DB = resolve(AQUI, "..");
const MIGRACIONES = join(PAQUETE_DB, "prisma", "migrations");
const RAIZ_REPO = resolve(PAQUETE_DB, "..", "..");

function leerArgumentos(argv: string[]) {
  const out: { bases?: string; aplicar: boolean; solo?: string[] } = { aplicar: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--bases") out.bases = argv[++i];
    else if (a === "--aplicar") out.aplicar = true;
    else if (a === "--solo") out.solo = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else {
      console.error(`Argumento desconocido: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

function leerBases(ruta: string): Array<[string, string]> {
  const absoluta = resolve(ruta.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"));
  if (absoluta.startsWith(RAIZ_REPO + "/")) {
    console.error(
      "El archivo de bases está dentro del repo. Movelo afuera: tiene contraseñas y no puede terminar en un commit.",
    );
    process.exit(2);
  }
  if (!existsSync(absoluta)) {
    console.error(`No existe ${absoluta}.`);
    process.exit(2);
  }
  const datos = JSON.parse(readFileSync(absoluta, "utf8")) as Record<string, unknown>;
  const bases = Object.entries(datos).filter((e): e is [string, string] => typeof e[1] === "string");
  if (bases.length === 0) {
    console.error("El archivo no tiene ninguna base.");
    process.exit(2);
  }
  if (bases.length !== 5) {
    console.warn(`Ojo: el archivo tiene ${bases.length} bases, no cinco.`);
  }
  return bases;
}

/** Solo el host: nunca se imprime usuario ni contraseña. */
function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(URL inválida)";
  }
}

function migracionesDelRepo(): string[] {
  return readdirSync(MIGRACIONES)
    .filter((n) => {
      const p = join(MIGRACIONES, n);
      return statSync(p).isDirectory() && existsSync(join(p, "migration.sql"));
    })
    .sort();
}

function checksum(nombre: string): string {
  return createHash("sha256").update(readFileSync(join(MIGRACIONES, nombre, "migration.sql"))).digest("hex");
}

async function leerEstado(url: string, delRepo: string[]): Promise<Estado> {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const filas = await prisma.$queryRaw<Fila[]>`
      SELECT migration_name, checksum, finished_at, rolled_back_at
      FROM "_prisma_migrations"
    `;
    const terminadas = new Map<string, string>();
    for (const f of filas) if (f.finished_at != null) terminadas.set(f.migration_name, f.checksum);
    const enRepo = new Set(delRepo);

    return {
      pendientes: delRepo.filter((n) => !terminadas.has(n)),
      checksumDistinto: delRepo.filter((n) => terminadas.has(n) && terminadas.get(n) !== checksum(n)),
      // Un intento que arrancó y no terminó ni se revirtió: la base quedó a medias.
      trabadas: [
        ...new Set(
          filas
            .filter((f) => f.finished_at == null && f.rolled_back_at == null && !terminadas.has(f.migration_name))
            .map((f) => f.migration_name),
        ),
      ],
      soloEnBase: [...terminadas.keys()].filter((n) => !enRepo.has(n)).sort(),
    };
  } finally {
    await prisma.$disconnect();
  }
}

function informar(nombre: string, url: string, e: Estado) {
  console.log(`\n=== ${nombre} (${host(url)}) ===`);
  console.log(e.pendientes.length ? `Pendientes (${e.pendientes.length}):` : "Pendientes: ninguna.");
  for (const n of e.pendientes) console.log(`  - ${n}`);
  if (e.checksumDistinto.length) {
    console.log("Aplicadas, pero con un archivo que cambió después (checksum distinto):");
    for (const n of e.checksumDistinto) console.log(`  ! ${n}`);
  }
  if (e.trabadas.length) {
    console.log("Intentos que quedaron a medias:");
    for (const n of e.trabadas) console.log(`  ! ${n}`);
  }
  if (e.soloEnBase.length) {
    console.log(`Anotadas en la base pero no en el repo (${e.soloEnBase.length}). No se tocan:`);
    for (const n of e.soloEnBase) console.log(`  · ${n}`);
  }
}

/** La migración y su fila de `_prisma_migrations`, en un solo comando: o queda todo o nada. */
function aplicarUna(url: string, nombre: string) {
  const sql = readFileSync(join(MIGRACIONES, nombre, "migration.sql"), "utf8");
  const registro = `
INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES ('${randomUUID()}', '${checksum(nombre)}', now(), '${nombre}', NULL, NULL, now(), 1);
`;
  const r = spawnSync("pnpm", ["exec", "prisma", "db", "execute", "--url", url, "--stdin"], {
    cwd: PAQUETE_DB,
    input: `${sql}\n;\n${registro}`,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    const salida = `${r.stdout ?? ""}${r.stderr ?? ""}`.replaceAll(url, "<url>");
    throw new Error(`Falló ${nombre}:\n${salida.trim()}`);
  }
}

async function main() {
  const args = leerArgumentos(process.argv.slice(2));
  if (!args.bases) {
    console.error("Falta --bases <archivo.json>. Ver el comentario al principio del script.");
    process.exit(2);
  }
  const bases = leerBases(args.bases);
  const delRepo = migracionesDelRepo();

  if (args.solo) {
    const desconocidas = args.solo.filter((n) => !delRepo.includes(n));
    if (desconocidas.length) {
      console.error(`No están en el repo: ${desconocidas.join(", ")}`);
      process.exit(2);
    }
  }

  // Primero se mira todo, en las cinco. Si algo está raro, no se escribe en ninguna.
  const estados: Array<[string, string, Estado]> = [];
  for (const [nombre, url] of bases) {
    const e = await leerEstado(url, delRepo);
    informar(nombre, url, e);
    estados.push([nombre, url, e]);
  }

  const conProblemas = estados.filter(([, , e]) => e.checksumDistinto.length || e.trabadas.length);
  if (!args.aplicar) {
    console.log("\nSolo se miró: no se escribió nada. Para aplicar, agregá --aplicar.");
    process.exit(conProblemas.length ? 1 : 0);
  }
  if (conProblemas.length) {
    console.error(
      `\nNo se aplica nada. ${conProblemas.length === 1 ? "Esta base tiene" : "Estas bases tienen"} migraciones con checksum distinto o a medias: ${conProblemas.map(([n]) => n).join(", ")}. Eso hay que resolverlo a mano primero.`,
    );
    process.exit(1);
  }

  // Las respuestas se leen como una fila de líneas: con `question()` se pierden
  // las que llegan antes de que se pregunte (por ejemplo, desde un pipe).
  const consola = createInterface({ input: process.stdin });
  const lineas = consola[Symbol.asyncIterator]();
  const preguntar = async (texto: string) => {
    process.stdout.write(texto);
    const r = await lineas.next();
    return r.done ? "" : r.value;
  };
  try {
    for (const [nombre, url, e] of estados) {
      const plan = args.solo ? e.pendientes.filter((n) => args.solo!.includes(n)) : e.pendientes;
      if (plan.length === 0) {
        console.log(`\n${nombre}: nada que aplicar.`);
        continue;
      }
      console.log(`\n${nombre} (${host(url)}): se van a aplicar ${plan.length}, en este orden:`);
      for (const n of plan) console.log(`  - ${n}`);
      const respuesta = await preguntar(`Para seguir, escribí el nombre de la base ("${nombre}"): `);
      if (respuesta.trim() !== nombre) {
        console.log("No coincide. Se detiene acá; las bases anteriores quedaron como estaban al terminar.");
        process.exit(1);
      }
      for (const n of plan) {
        process.stdout.write(`  ${n} … `);
        aplicarUna(url, n);
        console.log("ok");
      }
      const despues = await leerEstado(url, delRepo);
      const quedan = despues.pendientes.filter((n) => plan.includes(n));
      if (quedan.length) throw new Error(`${nombre}: después de aplicar siguen pendientes ${quedan.join(", ")}.`);
      console.log(`  ${nombre}: listo.`);
    }
  } finally {
    consola.close();
  }
  console.log("\nTerminado. Corré el script de nuevo sin --aplicar para ver el estado final de las cinco.");
}

main().catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  console.error("Se detuvo. Lo aplicado antes del error quedó aplicado; la migración que falló no dejó nada.");
  process.exit(1);
});
