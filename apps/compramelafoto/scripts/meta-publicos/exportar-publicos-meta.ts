/**
 * Exporta las listas de origen para los públicos personalizados de Meta (CompraMeLaFoto).
 *
 * - Solo LEE la base: todas las consultas corren dentro de una transacción READ ONLY.
 * - Los correos salen normalizados y cifrados en SHA-256. Nunca en texto plano.
 * - Escribe un CSV por lista en una carpeta FUERA del repositorio.
 * - No sube nada a Meta: la subida la hace Daniel en el Administrador de públicos.
 *
 * Uso (desde apps/compramelafoto):
 *   npx tsx scripts/meta-publicos/exportar-publicos-meta.ts [--politica-actualizada] [opciones]
 *
 * Opciones:
 *   --politica-actualizada   Obligatoria. Confirma que la política nueva (sección «Publicidad en redes
 *                            sociales») está publicada y que ya salió el correo de aviso con baja.
 *                            Sin esta marca el script solo muestra los conteos, no escribe archivos.
 *   --incluir-charlas-desde AAAA-MM-DD
 *                            Suma a la lista escolar a los inscriptos de la charla de foto escolar
 *                            (TalkLead) desde esa fecha. Usar la fecha en que se publicó el aviso del
 *                            formulario: los anteriores no lo vieron.
 *   --salida <carpeta>       Carpeta de salida (por defecto ~/Desktop/publicos-meta-AAAA-MM-DD).
 *
 * Requiere DATABASE_URL apuntando a la base de CLF.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import { armarCsv, cifrarLista } from "./cifrado";

const MINIMO_META = 100;

type Opciones = {
  politicaActualizada: boolean;
  charlasDesde: Date | null;
  salida: string;
};

function leerOpciones(argv: string[]): Opciones {
  const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
  const i = argv.indexOf("--salida");
  const c = argv.indexOf("--incluir-charlas-desde");
  let charlasDesde: Date | null = null;
  if (c >= 0) {
    const valor = argv[c + 1] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error("--incluir-charlas-desde necesita una fecha AAAA-MM-DD.");
    charlasDesde = new Date(`${valor}T00:00:00-03:00`);
  }
  return {
    politicaActualizada: argv.includes("--politica-actualizada"),
    charlasDesde,
    salida: resolve(i >= 0 && argv[i + 1] ? argv[i + 1] : join(homedir(), "Desktop", `publicos-meta-${hoy}`)),
  };
}

// La oposición se registra en unsubscribedAt: lo marca el enlace de baja de los correos y el
// interruptor «Novedades y publicidad» de Configuración. Quien se opuso no entra en NINGUNA lista.
const SIN_OPOSICION = Prisma.sql`u."unsubscribedAt" IS NULL`;

// Fotógrafos de Argentina (o sin país cargado), sin bloqueo y sin oposición.
const FILTRO_SEMILLA = Prisma.sql`u.role = 'PHOTOGRAPHER'
  AND u."isBlocked" = false
  AND ${SIN_OPOSICION}
  AND coalesce(u."countryCode", 'AR') = 'AR'`;

async function main() {
  const o = leerOpciones(process.argv.slice(2));
  const repo = resolve(__dirname, "../../../..");
  if (o.salida.startsWith(repo)) {
    throw new Error(`La carpeta de salida no puede estar dentro del repositorio (${repo}).`);
  }

  const prisma = new PrismaClient();
  const f = FILTRO_SEMILLA;

  const listas = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const correos = async (sql: Prisma.Sql) =>
      (await tx.$queryRaw<{ email: string }[]>(sql)).map((r) => r.email);

    const vendieron = await correos(Prisma.sql`
      SELECT DISTINCT u.email FROM "User" u
      JOIN "Album" a ON a."userId" = u.id
      JOIN "Order" ord ON ord."albumId" = a.id AND ord.status = 'PAID'
      WHERE ${f}`);

    const escolarUsuarios = await correos(Prisma.sql`
      SELECT DISTINCT u.email FROM "User" u
      JOIN "Album" a ON a."userId" = u.id
      WHERE (a.type = 'SCHOOL' OR a."schoolId" IS NOT NULL) AND ${f}`);

    const escolarCharlas = o.charlasDesde
      ? await correos(Prisma.sql`
          SELECT DISTINCT t.email FROM "TalkLead" t
          WHERE t.source LIKE 'charlafotoescolar%'
            AND t."createdAt" >= ${o.charlasDesde}
            AND NOT EXISTS (
              SELECT 1 FROM "User" u2
              WHERE lower(u2.email) = lower(trim(t.email)) AND u2."unsubscribedAt" IS NOT NULL)`)
      : [];

    const deportivo = await correos(Prisma.sql`
      SELECT DISTINCT u.email FROM "User" u
      JOIN "Album" a ON a."userId" = u.id
      WHERE a.type = 'SPORTS' AND ${f}`);

    // Exclusión: todo fotógrafo que ya tiene cuenta (de cualquier país), para no pagar por
    // mostrarle "registrate" a quien ya está registrado. También respeta la oposición.
    const exclusion = await correos(Prisma.sql`
      SELECT u.email FROM "User" u WHERE u.role = 'PHOTOGRAPHER' AND ${SIN_OPOSICION}`);

    return {
      "semilla-vendieron-general": vendieron,
      "semilla-escolar": [...escolarUsuarios, ...escolarCharlas],
      "semilla-deportivo": deportivo,
      "excluir-fotografos-registrados": exclusion,
    };
  });
  await prisma.$disconnect();

  const cifradas = Object.entries(listas).map(([nombre, correos]) => {
    const hashes = cifrarLista(correos);
    const esExclusion = nombre.startsWith("excluir");
    const alcanza = esExclusion || hashes.length >= MINIMO_META;
    console.log(
      `${nombre.padEnd(32)} ${String(hashes.length).padStart(5)} personas` +
        (esExclusion ? "  (exclusión: no necesita mínimo)" : alcanza ? "  ✔ llega a 100" : "  ✘ no llega a 100"),
    );
    return { nombre, hashes, alcanza };
  });

  if (!o.politicaActualizada) {
    console.log("\nNo se escribió ningún archivo. Falta --politica-actualizada (ver el documento de públicos).");
    return;
  }

  mkdirSync(o.salida, { recursive: true, mode: 0o700 });
  for (const { nombre, hashes, alcanza } of cifradas) {
    if (!alcanza) continue; // Meta no deja crear el similar con menos de 100.
    writeFileSync(join(o.salida, `${nombre}.csv`), armarCsv(hashes), { mode: 0o600 });
  }
  console.log(`\nArchivos en ${o.salida}. Subilos a Meta y después borrá la carpeta.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
