#!/usr/bin/env node
/**
 * Auditoría y recuperación de referidos que nunca se registraron.
 *
 * Modos:
 *   audit                        Informe de estado. Solo lectura.
 *   fix-roles [--apply]          Fotógrafos que quedaron con rol CUSTOMER por el panel
 *                                de registro unificado. Sin --apply solo lista.
 *   claim <archivo.csv> [--apply]
 *                                Carga atribuciones desde un CSV confirmado por vos.
 *                                Formato por línea: referidor,referido
 *                                (email o código de referido para el referidor;
 *                                 email o id de usuario para el referido)
 *
 * Uso:
 *   pnpm --filter compramelafoto referrals:audit
 *   pnpm --filter compramelafoto referrals:recover -- fix-roles
 *   pnpm --filter compramelafoto referrals:recover -- claim recuperar.csv --apply
 *
 * Sin --apply nunca escribe nada.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/prisma";
import { upsertManualReferralAttribution } from "@/lib/admin/referral-attribution-admin";

/** Deploy que reemplazó /registro por el panel unificado que creaba siempre CUSTOMER. */
const PANEL_UNIFICADO_DESDE = new Date("2026-08-31T00:00:00Z");

/** Indicios de que una cuenta CUSTOMER es en realidad de un fotógrafo. */
const PISTAS_FOTOGRAFO = [
  "foto",
  "fotos",
  "photo",
  "ph",
  "lens",
  "studio",
  "estudio",
  "imagen",
  "captur",
];

function pareceFotografo(email: string, name: string | null): boolean {
  const texto = `${email} ${name ?? ""}`.toLowerCase();
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  return PISTAS_FOTOGRAFO.some(
    (pista) => texto.includes(pista) || local.includes(pista)
  );
}

function fmt(n: number | bigint): string {
  return String(n).padStart(5, " ");
}

async function audit(): Promise<void> {
  const [
    totalCodigos,
    totalAtribuciones,
    ultimaAtribucion,
    altasSinAtribucion,
    clientesSospechosos,
    codigosSinReferidos,
  ] = await Promise.all([
    prisma.referralCode.count({ where: { isActive: true } }),
    prisma.referralAttribution.count(),
    prisma.referralAttribution.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.user.count({
      where: {
        role: { in: [Role.PHOTOGRAPHER, Role.ORGANIZER] },
        referralAttributionsAsReferred: null,
      },
    }),
    prisma.user.findMany({
      where: { role: Role.CUSTOMER, createdAt: { gte: PANEL_UNIFICADO_DESDE } },
      select: { id: true, email: true, name: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.referralCode.count({
      where: { isActive: true, attributions: { none: {} } },
    }),
  ]);

  console.log("\n=== Estado del programa de referidos ===");
  console.log(`${fmt(totalCodigos)}  códigos de referido activos`);
  console.log(`${fmt(codigosSinReferidos)}  de esos códigos nunca sumaron un referido`);
  console.log(`${fmt(totalAtribuciones)}  referidos registrados en total`);
  console.log(
    `        último referido registrado: ${
      ultimaAtribucion?.createdAt.toISOString().slice(0, 10) ?? "nunca"
    }`
  );
  console.log(
    `${fmt(altasSinAtribucion)}  fotógrafos/organizadores sin referidor asignado`
  );

  const candidatos = clientesSospechosos.filter((u) => pareceFotografo(u.email, u.name));
  console.log(
    `\n=== Cuentas creadas como cliente desde ${PANEL_UNIFICADO_DESDE.toISOString().slice(0, 10)} ===`
  );
  console.log(
    `${fmt(clientesSospechosos.length)}  cuentas CUSTOMER nuevas (${candidatos.length} con pinta de fotógrafo)`
  );
  for (const u of clientesSospechosos) {
    const marca = pareceFotografo(u.email, u.name) ? "  ← probable fotógrafo" : "";
    console.log(
      `  #${u.id}  ${u.createdAt.toISOString().slice(0, 10)}  ${u.email}  (${u.name ?? "sin nombre"})${marca}`
    );
  }

  console.log(
    "\nNota: no existe registro de quién refirió a estas personas: el sistema descartaba el"
  );
  console.log(
    "código sin guardarlo. Para recuperarlos usá `claim` con una lista que vos confirmes.\n"
  );
}

async function fixRoles(apply: boolean): Promise<void> {
  const clientes = await prisma.user.findMany({
    where: { role: Role.CUSTOMER, createdAt: { gte: PANEL_UNIFICADO_DESDE } },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const candidatos = clientes.filter((u) => pareceFotografo(u.email, u.name));

  console.log(
    `\n${candidatos.length} de ${clientes.length} cuentas CUSTOMER nuevas parecen de fotógrafos:\n`
  );
  for (const u of candidatos) {
    console.log(`  #${u.id}  ${u.email}  (${u.name ?? "sin nombre"})`);
  }

  if (!apply) {
    console.log("\nModo lectura. Agregá --apply para cambiarles el rol a PHOTOGRAPHER.\n");
    return;
  }

  for (const u of candidatos) {
    await prisma.user.update({
      where: { id: u.id },
      data: { role: Role.PHOTOGRAPHER, workingCoverageRadiusKm: 50 },
    });
    console.log(`  ✔ #${u.id} ${u.email} → PHOTOGRAPHER`);
  }
  console.log(`\n${candidatos.length} cuentas corregidas.\n`);
}

type ClaimRow = { referidor: string; referido: string; linea: number };

function parseCsv(path: string): ClaimRow[] {
  const raw = readFileSync(path, "utf8");
  const rows: ClaimRow[] = [];
  raw.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return;
    const [referidor, referido] = t.split(",").map((s) => s.trim());
    if (!referidor || !referido) return;
    if (referidor.toLowerCase() === "referidor") return; // encabezado
    rows.push({ referidor, referido, linea: i + 1 });
  });
  return rows;
}

async function resolveReferrer(valor: string): Promise<number | null> {
  if (valor.includes("@")) {
    const u = await prisma.user.findUnique({
      where: { email: valor.toLowerCase() },
      select: { id: true },
    });
    return u?.id ?? null;
  }
  const code = await prisma.referralCode.findUnique({
    where: { code: valor.toUpperCase() },
    select: { ownerUserId: true },
  });
  return code?.ownerUserId ?? null;
}

async function resolveReferred(valor: string): Promise<number | null> {
  if (/^\d+$/.test(valor)) {
    const u = await prisma.user.findUnique({
      where: { id: Number(valor) },
      select: { id: true },
    });
    return u?.id ?? null;
  }
  const u = await prisma.user.findUnique({
    where: { email: valor.toLowerCase() },
    select: { id: true },
  });
  return u?.id ?? null;
}

async function claim(path: string, apply: boolean): Promise<void> {
  const rows = parseCsv(path);
  console.log(`\n${rows.length} filas leídas de ${path}\n`);

  let ok = 0;
  let fallos = 0;

  for (const row of rows) {
    const referrerUserId = await resolveReferrer(row.referidor);
    const referredUserId = await resolveReferred(row.referido);

    if (!referrerUserId) {
      console.log(`  ✖ línea ${row.linea}: no encontré al referidor "${row.referidor}"`);
      fallos++;
      continue;
    }
    if (!referredUserId) {
      console.log(`  ✖ línea ${row.linea}: no encontré al referido "${row.referido}"`);
      fallos++;
      continue;
    }

    const yaTiene = await prisma.referralAttribution.findUnique({
      where: { referredUserId },
      select: { referrerUserId: true },
    });
    if (yaTiene) {
      const mismo = yaTiene.referrerUserId === referrerUserId;
      console.log(
        `  · línea ${row.linea}: ${row.referido} ya está atribuido${mismo ? " al mismo referidor" : " a OTRO referidor"}; se omite`
      );
      continue;
    }

    if (!apply) {
      console.log(`  → línea ${row.linea}: ${row.referidor} → ${row.referido} (listo para aplicar)`);
      ok++;
      continue;
    }

    try {
      const referido = await prisma.user.findUniqueOrThrow({
        where: { id: referredUserId },
        select: { createdAt: true },
      });
      await upsertManualReferralAttribution({
        referredUserId,
        referrerUserId,
        startsAt: referido.createdAt,
      });
      console.log(`  ✔ línea ${row.linea}: ${row.referidor} → ${row.referido}`);
      ok++;
    } catch (err) {
      console.log(
        `  ✖ línea ${row.linea}: ${err instanceof Error ? err.message : String(err)}`
      );
      fallos++;
    }
  }

  console.log(
    `\n${apply ? "Aplicados" : "Listos para aplicar"}: ${ok}. Con problemas: ${fallos}.`
  );
  if (!apply) console.log("Agregá --apply para escribir en la base.\n");
  else console.log("");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const modo = args.find((a) => !a.startsWith("--")) ?? "audit";

  if (modo === "audit") {
    await audit();
  } else if (modo === "fix-roles") {
    await fixRoles(apply);
  } else if (modo === "claim") {
    const path = args.filter((a) => !a.startsWith("--"))[1];
    if (!path) {
      console.error("Falta el archivo CSV: claim <archivo.csv> [--apply]");
      process.exitCode = 1;
      return;
    }
    await claim(path, apply);
  } else {
    console.error(`Modo desconocido: ${modo}. Usá audit | fix-roles | claim`);
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exitCode = 1;
});
