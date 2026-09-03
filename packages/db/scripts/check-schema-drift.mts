/**
 * Deriva entre el schema compartido y cada base del monorepo. Sólo lectura.
 *
 * El problema que ataca: `packages/db/prisma/schema.prisma` es uno solo para todas
 * las apps, pero cada app tiene su propia base. Si agregás un campo y lo aplicás en
 * una sola, las demás quedan con el cliente Prisma pidiendo una columna que su base
 * no tiene. No falla al leer con `select` acotado: falla al **escribir**, con error
 * P2022, porque Prisma devuelve todas las columnas del modelo cuando guarda.
 *
 * Por eso lo que importa acá no es "a esta base le faltan tablas" (normal: cada app
 * usa un subconjunto), sino "esta base **tiene** la tabla pero le faltan columnas".
 * Eso es lo que rompe en producción, y es lo único que marca como bloqueante.
 *
 * Uso (la URL va explícita; NO lee packages/db/.env):
 *   pnpm exec tsx scripts/check-schema-drift.mts \
 *     --target clickaton='postgresql://…' --target compramelafoto='postgresql://…'
 *
 *   DRIFT_TARGETS='{"clickaton":"postgresql://…"}' pnpm exec tsx scripts/check-schema-drift.mts
 *
 * Salida: 0 si no hay deriva bloqueante, 1 si la hay, 2 si el uso es incorrecto.
 * Imprime el SQL aditivo sugerido. No ejecuta nada: copiás y revisás vos.
 */
import { Prisma, PrismaClient } from "@prisma/client";

type Target = { label: string; url: string };

type ColumnaEsperada = {
  nombre: string;
  tipoSql: string;
  requerida: boolean;
  defaultSql: string | null;
  /** Nombre del tipo enum si la columna usa uno; la base puede no tenerlo creado. */
  enumType: string | null;
};

function parseArgs(argv: string[]): Target[] {
  const targets: Target[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--allow-write") {
      console.error("Refusing: this script is read-only (no --allow-write).");
      process.exit(2);
    }
    if (a === "--target") {
      const raw = argv[++i] ?? "";
      const sep = raw.indexOf("=");
      if (sep <= 0) {
        console.error(`--target mal formado: "${raw}". Se espera etiqueta=URL.`);
        process.exit(2);
      }
      targets.push({ label: raw.slice(0, sep), url: raw.slice(sep + 1) });
    }
  }

  const fromEnv = process.env.DRIFT_TARGETS;
  if (fromEnv) {
    let parsed: Record<string, string> | undefined;
    try {
      parsed = JSON.parse(fromEnv);
    } catch {
      console.error("DRIFT_TARGETS no es JSON válido. Se espera {\"etiqueta\":\"URL\"}.");
      process.exit(2);
    }
    for (const [label, url] of Object.entries(parsed ?? {})) targets.push({ label, url });
  }

  return targets;
}

/** Tipo Postgres para un campo escalar del DMMF. */
function tipoSql(field: Prisma.DMMF.Field, enums: Set<string>): string {
  const nativo = field.nativeType as [string, string[]] | null;
  let base: string;
  if (nativo) {
    const [nombre, args] = nativo;
    base = args?.length ? `${nombre}(${args.join(", ")})` : nombre;
  } else if (enums.has(field.type)) {
    base = `"${field.type}"`;
  } else {
    switch (field.type) {
      case "String": base = "TEXT"; break;
      case "Boolean": base = "BOOLEAN"; break;
      case "Int": base = "INTEGER"; break;
      case "BigInt": base = "BIGINT"; break;
      case "Float": base = "DOUBLE PRECISION"; break;
      case "Decimal": base = "DECIMAL(65,30)"; break;
      case "DateTime": base = "TIMESTAMP(3)"; break;
      case "Json": base = "JSONB"; break;
      case "Bytes": base = "BYTEA"; break;
      default: base = "TEXT"; break;
    }
  }
  return field.isList ? `${base}[]` : base;
}

/** Literal SQL del @default, o null si no lo podemos representar sin ambigüedad. */
function defaultSql(field: Prisma.DMMF.Field, enums: Set<string>): string | null {
  if (!field.hasDefaultValue) return null;
  const d = field.default as unknown;

  if (typeof d === "object" && d !== null && "name" in (d as Record<string, unknown>)) {
    const nombre = (d as { name: string }).name;
    if (nombre === "now") return "CURRENT_TIMESTAMP";
    if (nombre === "dbgenerated") return null;
    // uuid(), cuid(), autoincrement()… los resuelve Prisma, no la base.
    return null;
  }
  if (Array.isArray(d)) {
    if (d.length === 0) return "ARRAY[]::" + tipoSql(field, enums);
    return null;
  }
  if (typeof d === "boolean") return d ? "true" : "false";
  if (typeof d === "number") return String(d);
  if (typeof d === "string") {
    return enums.has(field.type) ? `'${d}'::"${field.type}"` : `'${d.replace(/'/g, "''")}'`;
  }
  return null;
}

/** Tabla -> columnas escalares que el schema espera. */
function columnasEsperadas(): Map<string, ColumnaEsperada[]> {
  const enums = new Set(Prisma.dmmf.datamodel.enums.map((e) => e.dbName ?? e.name));
  const salida = new Map<string, ColumnaEsperada[]>();

  for (const model of Prisma.dmmf.datamodel.models) {
    const tabla = model.dbName ?? model.name;
    const columnas: ColumnaEsperada[] = [];
    for (const field of model.fields) {
      // Las relaciones no son columnas; la clave foránea viaja en su propio campo escalar.
      if (field.kind === "object") continue;
      columnas.push({
        nombre: field.dbName ?? field.name,
        tipoSql: tipoSql(field, enums),
        requerida: field.isRequired && !field.isList,
        defaultSql: defaultSql(field, enums),
        enumType: enums.has(field.type) ? field.type : null,
      });
    }
    salida.set(tabla, columnas);
  }
  return salida;
}

/**
 * CREATE TYPE idempotente. Sin esto, el ALTER de una columna enum falla en las bases
 * que nunca corrieron la migración que creó el tipo.
 */
function createTypeSql(nombreEnum: string): string | null {
  const def = Prisma.dmmf.datamodel.enums.find((e) => (e.dbName ?? e.name) === nombreEnum);
  if (!def) return null;
  const valores = def.values.map((v) => `'${(v.dbName ?? v.name).replace(/'/g, "''")}'`).join(", ");
  return (
    `DO $$ BEGIN CREATE TYPE "${nombreEnum}" AS ENUM (${valores}); ` +
    `EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
  );
}

function alterSql(tabla: string, col: ColumnaEsperada): string {
  const partes = [`ALTER TABLE "${tabla}" ADD COLUMN IF NOT EXISTS "${col.nombre}" ${col.tipoSql}`];
  if (col.defaultSql) partes.push(`DEFAULT ${col.defaultSql}`);
  if (col.requerida && col.defaultSql) partes.push("NOT NULL");
  const sql = partes.join(" ") + ";";
  if (col.requerida && !col.defaultSql) {
    // NOT NULL sin default revienta si la tabla ya tiene filas: queda opcional y lo decide una persona.
    return `${sql}  -- REVISAR: el schema la pide NOT NULL pero no tiene default; rellenar y luego SET NOT NULL`;
  }
  return sql;
}

async function revisarBase(target: Target, esperadas: Map<string, ColumnaEsperada[]>) {
  const prisma = new PrismaClient({ datasources: { db: { url: target.url } } });
  try {
    const filas = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `;

    // reltuples es la estimación del planner: alcanza para saber si la app usa la tabla,
    // y no cuesta un COUNT(*) sobre cientos de tablas.
    const tamanos = await prisma.$queryRaw<Array<{ relname: string; filas: number }>>`
      SELECT c.relname, GREATEST(c.reltuples, 0)::float8 AS filas
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    `;
    const conDatos = new Set(tamanos.filter((t) => t.filas > 0).map((t) => t.relname));

    const tiposEnum = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typtype = 'e'
    `;
    const enumsPresentes = new Set(tiposEnum.map((t) => t.typname));

    const reales = new Map<string, Set<string>>();
    for (const f of filas) {
      let cols = reales.get(f.table_name);
      if (!cols) reales.set(f.table_name, (cols = new Set()));
      cols.add(f.column_name);
    }

    const urgentes: Array<{ tabla: string; col: ColumnaEsperada }> = [];
    const latentes: Array<{ tabla: string; col: ColumnaEsperada }> = [];
    let tablasAusentes = 0;

    for (const [tabla, columnas] of esperadas) {
      const real = reales.get(tabla);
      if (!real) {
        // Esta app no usa la tabla. Normal en un schema compartido: no rompe nada.
        tablasAusentes++;
        continue;
      }
      const destino = conDatos.has(tabla) ? urgentes : latentes;
      for (const col of columnas) {
        if (!real.has(col.nombre)) destino.push({ tabla, col });
      }
    }

    // Tipos enum que hacen falta para que los ALTER de arriba no revienten.
    const enumsFaltantes = new Set<string>();
    for (const { col } of [...urgentes, ...latentes]) {
      if (col.enumType && !enumsPresentes.has(col.enumType)) enumsFaltantes.add(col.enumType);
    }

    return {
      urgentes,
      latentes,
      enumsFaltantes: [...enumsFaltantes].sort(),
      tablasAusentes,
      tablasPresentes: esperadas.size - tablasAusentes,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const targets = parseArgs(process.argv.slice(2));
  if (targets.length === 0) {
    console.error(
      "Falta al menos un destino.\n" +
        "  --target etiqueta='postgresql://…'   (se puede repetir)\n" +
        "  DRIFT_TARGETS='{\"etiqueta\":\"postgresql://…\"}'\n" +
        "No lee packages/db/.env a propósito: hay que decir explícitamente qué base mirás.",
    );
    process.exit(2);
  }

  const esperadas = columnasEsperadas();
  console.log(`Schema compartido: ${esperadas.size} tablas.\n`);

  let hayDeriva = false;

  for (const target of targets) {
    let resultado: Awaited<ReturnType<typeof revisarBase>>;
    try {
      resultado = await revisarBase(target, esperadas);
    } catch (err) {
      console.error(`✗ ${target.label}: no se pudo consultar — ${String((err as Error).message)}`);
      hayDeriva = true;
      continue;
    }

    const { urgentes, latentes, enumsFaltantes, tablasPresentes, tablasAusentes } = resultado;
    console.log(`── ${target.label}`);
    console.log(`   ${tablasPresentes} tablas del schema presentes, ${tablasAusentes} no usadas por esta app.`);

    if (urgentes.length === 0 && latentes.length === 0) {
      console.log("   ✓ sin columnas faltantes: las escrituras no se van a romper.\n");
      continue;
    }

    hayDeriva = true;

    if (enumsFaltantes.length > 0) {
      console.log(`   · ${enumsFaltantes.length} tipo(s) enum que esta base no tiene. Van PRIMERO:\n`);
      for (const nombre of enumsFaltantes) {
        const sql = createTypeSql(nombre);
        if (sql) console.log(`     ${sql}`);
      }
      console.log("");
    }

    if (urgentes.length > 0) {
      console.log(`   ✗ URGENTE — ${urgentes.length} columna(s) faltante(s) en tablas CON DATOS.`);
      console.log("     Esta app usa esas tablas: la próxima escritura falla con P2022.\n");
      for (const { tabla, col } of urgentes) console.log(`     ${alterSql(tabla, col)}`);
      console.log("");
    }

    if (latentes.length > 0) {
      console.log(`   · latente — ${latentes.length} columna(s) faltante(s) en tablas vacías.`);
      console.log("     Hoy no rompe nada; rompe el día que esta app escriba ahí por primera vez.\n");
      for (const { tabla, col } of latentes) console.log(`     ${alterSql(tabla, col)}`);
      console.log("");
    }
  }

  if (hayDeriva) {
    console.log("Resultado: hay deriva. Aplicá el SQL de arriba antes de desplegar.");
    process.exit(1);
  }
  console.log("Resultado: todas las bases al día con el schema compartido.");
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
