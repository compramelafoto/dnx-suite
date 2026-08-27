/**
 * SFPR — corrección de la fecha de alta de cada socio.
 *
 * El padrón migrado traía `joinedAt` poco confiable: 80 socios con un valor por defecto de la
 * importación, y otros con fechas imposibles (el socio 476 figuraba asociándose a los 5 años).
 * Daniel aportó el listado de cuándo cada socio completó el formulario de inscripción.
 *
 * REGLA: se toma la fecha MÁS ANTIGUA de las dos, pero la de la base solo gana si es creíble,
 * es decir si el socio tenía al menos 15 años al asociarse y la fecha no está en el futuro.
 *
 * Por qué no se pisa todo con el listado: ese listado dice cuándo alguien llenó un formulario,
 * no cuándo entró a la Sociedad. La mayoría son de una campaña de registro de 2020. Aplicarlo
 * a ciegas le diría al socio 255 —nacido en 1947, con alta en 1972— que tiene 6 años de
 * antigüedad en vez de 54. Al socio se le muestra esto sobre sí mismo: errar por defecto es
 * ofensivo, y no hay forma de que lo corrija por su cuenta.
 *
 * A quien no tiene fecha en el listado no se le inventa ninguna: se lo deja como está.
 *
 * Uso (URL explícita obligatoria — NO carga packages/db/.env):
 *   DATABASE_URL='postgresql://…' pnpm exec tsx scripts/sfpr-corregir-antiguedad.mts --plan ruta.json
 *   … --plan ruta.json --execute
 */
import { readFileSync } from "node:fs";
import { PrismaClient, MemberAuditAction, MemberAuditSource } from "@prisma/client";

const WORKSPACE = "SFPR";

type Plan = {
  cambios: { socio: string; de: string; a: string; motivo: string }[];
  conserva: { socio: string; joinedAt: string; listado: string }[];
  sinFechaEnListado: string[];
};

function args(argv: string[]) {
  const o: { plan?: string; execute: boolean; url?: string } = { execute: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--plan") o.plan = argv[++i];
    else if (argv[i] === "--execute") o.execute = true;
    else if (argv[i] === "--url") o.url = argv[++i];
  }
  return o;
}

async function main() {
  const a = args(process.argv.slice(2));
  if (!a.plan) throw new Error("Falta --plan ruta.json");
  const url = a.url ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (o --url). Este script no lee packages/db/.env.");

  const plan: Plan = JSON.parse(readFileSync(a.plan, "utf8"));
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const batchId = `sfpr-antiguedad-${new Date().toISOString().slice(0, 10)}`;

  const ws = await prisma.workspace.findFirst({ where: { name: WORKSPACE }, select: { id: true } });
  if (!ws) throw new Error(`No existe el workspace ${WORKSPACE}`);

  const members = await prisma.member.findMany({
    where: { workspaceId: ws.id, memberNumber: { in: plan.cambios.map((c) => c.socio) } },
    select: { id: true, memberNumber: true, joinedAt: true },
  });
  const byNum = new Map(members.map((m) => [m.memberNumber, m]));
  const faltantes = plan.cambios.filter((c) => !byNum.has(c.socio)).map((c) => c.socio);

  console.log(`\n═══ CORRECCIÓN DE ANTIGÜEDAD — workspace ${WORKSPACE} ═══`);
  console.log(`  modo: ${a.execute ? "EJECUTAR (escribe)" : "SIMULACIÓN (no escribe nada)"}`);
  console.log(`  lote: ${batchId}\n`);
  console.log(`  se corrigen con el listado:       ${plan.cambios.length}`);
  console.log(`  conservan su fecha (más antigua y creíble): ${plan.conserva.length}`);
  console.log(`  sin fecha en el listado, no se tocan:       ${plan.sinFechaEnListado.length}`);

  const porMotivo = new Map<string, number>();
  for (const c of plan.cambios) porMotivo.set(c.motivo, (porMotivo.get(c.motivo) ?? 0) + 1);
  console.log(`\n  motivo de cada corrección:`);
  for (const [m, n] of porMotivo) console.log(`    ${m}: ${n}`);

  if (faltantes.length) {
    console.log(`\n  ✗ no están en la base: ${faltantes.join(", ")}`);
    throw new Error("Hay socios del plan que no están en la base. Se aborta sin escribir.");
  }
  console.log(`\n  ✓ los ${plan.cambios.length} socios a corregir existen en la base`);

  if (!a.execute) {
    console.log(`\n  No se escribió nada. Para aplicar, repetir con --execute\n`);
    await prisma.$disconnect();
    return;
  }

  const n = await prisma.$transaction(async (tx) => {
    let hechos = 0;
    for (const c of plan.cambios) {
      const m = byNum.get(c.socio)!;
      const nueva = new Date(`${c.a}T00:00:00.000Z`);
      if (m.joinedAt.toISOString().slice(0, 10) === c.a) continue;
      await tx.member.update({ where: { id: m.id }, data: { joinedAt: nueva } });
      await tx.memberAudit.create({ data: { workspaceId: ws.id, memberId: m.id,
        action: MemberAuditAction.UPDATED, source: MemberAuditSource.CSV_IMPORT, batchId,
        actorLabel: "Corrección de antigüedad",
        reason: `Fecha de alta corregida con el listado de inscripciones: ${c.motivo}`,
        changesJson: { joinedAt: { de: m.joinedAt.toISOString().slice(0, 10), a: c.a } } } });
      hechos++;
    }
    return hechos;
  }, { timeout: 120_000 });

  console.log(`\n  APLICADO: ${n} fechas corregidas`);
  console.log(`  Lote de auditoría: ${batchId}\n`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error("\n✗", e.message, "\n"); process.exit(1); });
