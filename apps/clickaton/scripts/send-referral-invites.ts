/**
 * Envía a cada participante su link de invitación.
 *
 * Reutilizable: se corre ahora para el anuncio y más adelante para recordarlo.
 * Cada envío lleva su propia `--campania`, que es lo que permite que un
 * recordatorio de noviembre no quede bloqueado por la cola idempotente del
 * anuncio de septiembre.
 *
 *   # 1. mirar a quién le tocaría, sin mandar nada
 *   pnpm tsx scripts/send-referral-invites.ts --campania lanzamiento-2026-09 --dry-run
 *
 *   # 2. probarlo en una dirección propia
 *   pnpm tsx scripts/send-referral-invites.ts --campania lanzamiento-2026-09 --solo vos@ejemplo.com
 *
 *   # 3. recién entonces, a todos
 *   pnpm tsx scripts/send-referral-invites.ts --campania lanzamiento-2026-09 --confirmar
 *
 * Sin `--confirmar` nunca escribe a nadie: es a propósito.
 */
import { prisma } from "@repo/db";

import { obtenerOCrearCodigoDeReferido } from "@/lib/referrals/infrastructure/prisma-referral-repository";
import { sendReferralInviteEmail } from "@/lib/referrals/notifications/referral-invite-email";

function arg(nombre: string): string | null {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}
function flag(nombre: string): boolean {
  return process.argv.includes(`--${nombre}`);
}

async function main() {
  const campania = arg("campania");
  const solo = arg("solo");
  const dryRun = flag("dry-run");
  const confirmar = flag("confirmar");

  if (!campania) {
    console.error("Falta --campania (ej. lanzamiento-2026-09).");
    process.exit(1);
  }

  // Sólo quien vivió una Clickatón: el programa premia haber participado.
  const destinatarios = await prisma.user.findMany({
    where: {
      clickatonRegistrations: { some: { status: "CONFIRMED" } },
      ...(solo ? { email: { equals: solo, mode: "insensitive" } } : {}),
    },
    select: { id: true, email: true, name: true },
    orderBy: { id: "asc" },
  });

  console.log(`\nCampaña: ${campania}`);
  console.log(`Destinatarios: ${destinatarios.length}${solo ? ` (filtrado a ${solo})` : ""}`);

  if (dryRun || (!confirmar && !solo)) {
    console.log("\nModo lista — NO se envía nada.\n");
    for (const u of destinatarios) console.log(`  ${u.email}${u.name ? ` — ${u.name}` : ""}`);
    console.log(
      `\nPara enviar de verdad: --confirmar (a todos) o --solo <email> (a uno).\n`,
    );
    return;
  }

  let enviados = 0;
  let fallados = 0;

  for (const u of destinatarios) {
    try {
      const codigo = await obtenerOCrearCodigoDeReferido(u.id);
      const colegas = await prisma.clickatonReferralAttribution.count({
        where: { referrerUserId: u.id, status: "EARNED" },
      });

      const r = await sendReferralInviteEmail({
        userId: u.id,
        to: u.email,
        firstName: u.name?.split(" ")[0] ?? null,
        code: codigo.code,
        colegas,
        campaignKey: campania,
      });

      // ALREADY_SENT no es una falla: significa que ya le había llegado.
      const ok = r.status === "SENT" || r.status === "ALREADY_SENT" || r.status === "QUEUED";
      if (ok) enviados += 1;
      else fallados += 1;
      console.log(`  ${ok ? "OK " : "ERR"}  ${u.email} — ${codigo.code} — ${r.status}`);
    } catch (e) {
      fallados += 1;
      console.log(`  ERR  ${u.email} — ${e instanceof Error ? e.message : "error"}`);
    }
  }

  console.log(`\nEnviados: ${enviados} · Con error: ${fallados}\n`);
  process.exit(fallados > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
