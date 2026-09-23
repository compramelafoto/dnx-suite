/**
 * Admite las entregas que esperan decisión humana por un único motivo: el
 * archivo llegó sin fecha de captura (`EXIF_CAPTURE_DATE_ABSENT`).
 *
 * Corre el mismo camino que el botón del panel —`resolveManualReview`—, así
 * que deja la decisión, la auditoría y el aviso encolado igual que si alguien
 * los hubiera apretado uno por uno. No toca ninguna otra entrega: si el motivo
 * es otro, la saltea y la informa.
 *
 * Uso: DATABASE_URL=... tsx scripts/admitir-pendientes-sin-fecha.ts <editionId> [--aplicar]
 */
import { prisma } from "@/lib/admin/db";
import {
  listarPendientesDeRevision,
  resolveManualReview,
} from "@/lib/technical-admission/service";

const MOTIVO_ESPERADO = "EXIF_CAPTURE_DATE_ABSENT";
const EMAIL_DEL_ACTOR = "dnxfotografia@gmail.com";

async function main() {
  const editionId = process.argv[2];
  const aplicar = process.argv.includes("--aplicar");
  if (!editionId) throw new Error("Falta el id de la edición.");

  const usuario = await prisma.user.findUnique({
    where: { email: EMAIL_DEL_ACTOR },
    select: { id: true, email: true, globalRole: true },
  });
  if (!usuario) throw new Error(`No existe el usuario ${EMAIL_DEL_ACTOR} en esta base.`);
  const actor = { id: usuario.id, email: usuario.email, globalRole: usuario.globalRole };

  const pendientes = await listarPendientesDeRevision({ editionId, actor, limite: 1000 });
  const sinFecha = pendientes.filter((p) => p.razonDeCaptura === MOTIVO_ESPERADO);
  const otras = pendientes.filter((p) => p.razonDeCaptura !== MOTIVO_ESPERADO);

  console.log(`Esperan decisión: ${pendientes.length}`);
  console.log(`  sin fecha de captura: ${sinFecha.length}`);
  console.log(`  con otro motivo (no se tocan): ${otras.length}`);
  for (const o of otras) {
    console.log(`    - ${o.participante} consigna ${o.consignaNumero}: ${o.razonDeCaptura}`);
  }

  if (!aplicar) {
    console.log("\nEnsayo. Volvé a correrlo con --aplicar para admitirlas.");
    return;
  }

  let admitidas = 0;
  const fallos: string[] = [];
  for (const p of sinFecha) {
    try {
      await resolveManualReview({
        editionId,
        submissionId: p.submissionId,
        actor,
        decision: "ADMIT",
        notes: "Revisión manual: el archivo llegó sin fecha de captura y la carga fue en término.",
      });
      admitidas += 1;
      console.log(`  ✓ ${p.participante} consigna ${p.consignaNumero}`);
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      fallos.push(`${p.participante} consigna ${p.consignaNumero}: ${detalle}`);
      console.log(`  ✗ ${p.participante} consigna ${p.consignaNumero}: ${detalle}`);
    }
  }

  console.log(`\nAdmitidas: ${admitidas} de ${sinFecha.length}`);
  if (fallos.length > 0) {
    console.log(`Fallaron ${fallos.length}:`);
    for (const f of fallos) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
