/**
 * SFPR — importación del padrón desde el sistema anterior.
 *
 * Aplica un plan generado a partir de las tres exportaciones (activos, inactivos y el
 * reporte de imputación de pagos). Ver docs/fotoffice/ANALISIS-PADRON-SFPR.md.
 *
 * Uso (URL explícita obligatoria — NO carga packages/db/.env):
 *   DATABASE_URL='postgresql://…' pnpm exec tsx scripts/sfpr-import-padron.mts --plan ruta/plan.json
 *   … --plan ruta/plan.json --execute        ← única forma de escribir
 *
 * Seguridad:
 *   - Sin --execute no escribe absolutamente nada: simula e informa.
 *   - Con --execute corre dentro de UNA transacción: o entra todo, o no entra nada.
 *   - Es idempotente: el cargo de apertura usa la clave (socio, OTRO, "APERTURA"), así que
 *     repetir la corrida no duplica deuda.
 *   - Deja auditoría por cada socio tocado, con batchId común para poder revertir.
 *
 * No hace: importar los socios inactivos, resolver el crédito a favor del socio 617, ni
 * tocar la configuración de cobro. Son decisiones pendientes.
 */
import { readFileSync } from "node:fs";
import { PrismaClient, MemberStatus, MemberLeftReason, MembershipChargeConcept,
         MemberAuditAction, MemberAuditSource } from "@prisma/client";

const WORKSPACE = "SFPR";
const APERTURA_PERIOD = "APERTURA";
/** La deuda que se importa ya estaba vencida: nace vencida, que es la verdad. */
const APERTURA_DUE = new Date("2026-08-31T00:00:00.000Z");

type Plan = {
  escalaCuota: { categoria: string; montoArs: number; vigenteDesde: string; vigenteHasta: string | null }[];
  honorarios: { socio: string; saldo: number }[];
  bajas: { socio: string; cuotas: number; saldo: number; motivo: string }[];
  cargoApertura: { socio: string; montoArs: number; cuotas: number }[];
  sinAccion: string[];
  avisos: string[];
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

const money = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

async function main() {
  const a = args(process.argv.slice(2));
  if (!a.plan) throw new Error("Falta --plan ruta/plan.json");
  const url = a.url ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (o --url). Este script no lee packages/db/.env.");

  const plan: Plan = JSON.parse(readFileSync(a.plan, "utf8"));
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const batchId = `sfpr-import-${new Date().toISOString().slice(0, 10)}`;

  const ws = await prisma.workspace.findFirst({ where: { name: WORKSPACE }, select: { id: true } });
  if (!ws) throw new Error(`No existe el workspace ${WORKSPACE}`);

  const cats = await prisma.memberCategory.findMany({ where: { workspaceId: ws.id }, select: { id: true, name: true } });
  const catId = new Map(cats.map((c) => [c.name, c.id]));

  const numeros = [
    ...plan.honorarios.map((x) => x.socio),
    ...plan.bajas.map((x) => x.socio),
    ...plan.cargoApertura.map((x) => x.socio),
  ];
  const members = await prisma.member.findMany({
    where: { workspaceId: ws.id, memberNumber: { in: numeros } },
    select: { id: true, memberNumber: true, status: true, categoryId: true },
  });
  const byNum = new Map(members.map((m) => [m.memberNumber, m]));

  const faltantes = numeros.filter((n) => !byNum.has(n));
  const yaConApertura = await prisma.membershipCharge.findMany({
    where: { workspaceId: ws.id, concept: MembershipChargeConcept.OTRO, period: APERTURA_PERIOD },
    select: { memberId: true },
  });
  const conApertura = new Set(yaConApertura.map((c) => c.memberId));

  console.log(`\n═══ PLAN DE IMPORTACIÓN — workspace ${WORKSPACE} ═══`);
  console.log(`  modo: ${a.execute ? "EJECUTAR (escribe)" : "SIMULACIÓN (no escribe nada)"}`);
  console.log(`  lote: ${batchId}\n`);

  console.log(`  Escala de cuota a registrar: ${plan.escalaCuota.length}`);
  for (const e of plan.escalaCuota) {
    const has = catId.has(e.categoria);
    console.log(`    ${has ? "·" : "✗"} ${e.categoria}: ${money(e.montoArs)} desde ${e.vigenteDesde}` +
      (e.vigenteHasta ? ` hasta ${e.vigenteHasta}` : "") + (has ? "" : "   ← CATEGORÍA INEXISTENTE"));
  }
  console.log(`\n  A categoría Honorario: ${plan.honorarios.length} socios`);
  console.log(`  A dar de baja:         ${plan.bajas.length} socios — ${money(plan.bajas.reduce((s, x) => s + x.saldo, 0))} salen del padrón activo`);
  const nuevos = plan.cargoApertura.filter((x) => { const m = byNum.get(x.socio); return m && !conApertura.has(m.id); });
  console.log(`  Cargo de apertura:     ${nuevos.length} socios — ${money(nuevos.reduce((s, x) => s + x.montoArs, 0))}` +
    (nuevos.length !== plan.cargoApertura.length ? `   (${plan.cargoApertura.length - nuevos.length} ya lo tenían)` : ""));
  console.log(`  Sin acción:            ${plan.sinAccion.length} socios en cero`);

  if (faltantes.length) {
    console.log(`\n  ✗ ${faltantes.length} socios del plan NO existen en la base: ${faltantes.join(", ")}`);
    throw new Error("Hay socios del plan que no están en la base. Se aborta sin escribir.");
  }
  console.log(`\n  ✓ los ${numeros.length} socios del plan existen en la base`);

  if (plan.avisos.length) {
    console.log(`\n  AVISOS (no se actúa sobre ellos):`);
    for (const v of plan.avisos) console.log(`    - ${v}`);
  }

  if (!a.execute) {
    console.log(`\n  No se escribió nada. Para aplicar, repetir con --execute\n`);
    await prisma.$disconnect();
    return;
  }

  const r = await prisma.$transaction(async (tx) => {
    let escalas = 0, hon = 0, bajas = 0, cargos = 0;

    for (const e of plan.escalaCuota) {
      const cid = catId.get(e.categoria);
      if (!cid) continue;
      const validFrom = new Date(`${e.vigenteDesde}T00:00:00.000Z`);
      const existe = await tx.membershipFeeValue.findFirst({ where: { workspaceId: ws.id, categoryId: cid, validFrom } });
      if (existe) continue;
      await tx.membershipFeeValue.create({ data: { workspaceId: ws.id, categoryId: cid,
        amountArs: e.montoArs, validFrom,
        validUntil: e.vigenteHasta ? new Date(`${e.vigenteHasta}T00:00:00.000Z`) : null } });
      escalas++;
    }

    const honCat = catId.get("Honorario");
    for (const h of plan.honorarios) {
      const m = byNum.get(h.socio)!;
      if (!honCat || m.categoryId === honCat) continue;
      await tx.member.update({ where: { id: m.id }, data: { categoryId: honCat } });
      await tx.memberAudit.create({ data: { workspaceId: ws.id, memberId: m.id,
        action: MemberAuditAction.UPDATED, source: MemberAuditSource.CSV_IMPORT, batchId,
        actorLabel: "Importación padrón SFPR", reason: "Exento en el sistema anterior: pasa a Honorario",
        changesJson: { categoria: { de: m.categoryId, a: honCat } } } });
      hon++;
    }

    const now = new Date();
    for (const b of plan.bajas) {
      const m = byNum.get(b.socio)!;
      if (m.status === MemberStatus.INACTIVE) continue;
      await tx.member.update({ where: { id: m.id },
        data: { status: MemberStatus.INACTIVE, leftReason: MemberLeftReason.DEUDA, leftAt: now } });
      await tx.memberAudit.create({ data: { workspaceId: ws.id, memberId: m.id,
        action: MemberAuditAction.STATUS_CHANGED, source: MemberAuditSource.CSV_IMPORT, batchId,
        actorLabel: "Importación padrón SFPR",
        reason: `Baja transitoria por deuda: ${b.cuotas} cuotas adeudadas al 2026-08-27`,
        changesJson: { estado: { de: m.status, a: "INACTIVE" }, cuotas: b.cuotas, saldo: b.saldo } } });
      bajas++;
    }

    for (const c of plan.cargoApertura) {
      const m = byNum.get(c.socio)!;
      if (conApertura.has(m.id)) continue;
      await tx.membershipCharge.create({ data: { workspaceId: ws.id, memberId: m.id,
        concept: MembershipChargeConcept.OTRO, period: APERTURA_PERIOD,
        amountArs: c.montoArs, balanceArs: c.montoArs, dueDate: APERTURA_DUE } });
      await tx.memberAudit.create({ data: { workspaceId: ws.id, memberId: m.id,
        action: MemberAuditAction.IMPORTED, source: MemberAuditSource.CSV_IMPORT, batchId,
        actorLabel: "Importación padrón SFPR",
        reason: "Saldo de apertura traído del sistema anterior",
        changesJson: { montoArs: c.montoArs, cuotasEnOrigen: c.cuotas } } });
      cargos++;
    }
    return { escalas, hon, bajas, cargos };
  }, { timeout: 120_000 });

  console.log(`\n  APLICADO:`);
  console.log(`    valores de cuota creados: ${r.escalas}`);
  console.log(`    pasados a Honorario:      ${r.hon}`);
  console.log(`    dados de baja:            ${r.bajas}`);
  console.log(`    cargos de apertura:       ${r.cargos}`);
  console.log(`\n  Lote de auditoría: ${batchId}\n`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error("\n✗", e.message, "\n"); process.exit(1); });
