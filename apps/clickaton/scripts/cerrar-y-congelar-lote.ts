/**
 * Cierra el lote de admisión de una edición y lo congela para el jurado.
 *
 * Corre el mismo camino que los botones del panel: cerrar deja el lote quieto y
 * congelar le pone a cada obra su código anónimo y su copia de jurado. A partir
 * de ahí el portal del jurado tiene algo que mostrar; antes, no.
 *
 * Ensaya primero. Con --aplicar hace el trabajo.
 *
 * Uso: DATABASE_URL=... tsx scripts/cerrar-y-congelar-lote.ts <editionId> [--aplicar]
 */
import { prisma } from "@/lib/admin/db";
import {
  closeAdmissionBatch,
  freezeAdmittedEntries,
  getAdmissionDashboard,
} from "@/lib/technical-admission/service";

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

  const dash = await getAdmissionDashboard(editionId, actor);
  const lote = dash.batch;
  if (!lote) throw new Error("Esta edición no tiene lote de admisión.");

  console.log(`Lote ${lote.id} — estado ${lote.status}`);
  console.log(
    `  admitidas: ${dash.totals.admitted} · esperando decisión: ${dash.totals.pendingReview} · ` +
      `rechazadas: ${dash.totals.rejected} · sin revisar: ${dash.totals.sinRevisar}`,
  );

  if (dash.totals.pendingReview > 0 || dash.totals.sinRevisar > 0) {
    console.log("\nQuedan obras sin decidir. Resolvelas antes de cerrar.");
    return;
  }

  if (!aplicar) {
    console.log("\nEnsayo. Volvé a correrlo con --aplicar para cerrar y congelar.");
    return;
  }

  if (lote.status !== "CLOSED" && lote.status !== "FROZEN") {
    const cerrado = await closeAdmissionBatch({ editionId, batchId: lote.id, actor });
    console.log(`\nCerrado: ${JSON.stringify(cerrado)}`);
  } else {
    console.log(`\nEl lote ya estaba en ${lote.status}.`);
  }

  const congelado = await freezeAdmittedEntries({ editionId, batchId: lote.id, actor });
  console.log(
    congelado.alreadyFrozen
      ? "Ya estaba congelado."
      : `Congeladas ${congelado.frozen} obras para el jurado.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
