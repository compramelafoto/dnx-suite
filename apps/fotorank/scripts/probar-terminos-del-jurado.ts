/**
 * Prueba que aceptar los términos funcione, y deshace lo que escribe.
 *
 * Es el primer paso del jurado y el que estaba roto: preguntaba por el concurso
 * en la base de FotoRank y contestaba "Concurso no encontrado" justo cuando
 * alguien quería empezar.
 *
 * Correr con `DATABASE_URL` de FotoRank y `CLICKATON_JURY_DATABASE_URL` de
 * Clickatón: la configuración real.
 *
 * Uso: tsx scripts/probar-terminos-del-jurado.ts <contestId> <email>
 */
import { prisma } from "@repo/db";

import { baseDelConcurso } from "../app/lib/fotorank/jury/baseDelConcurso";
import { acceptJuryTerms, hasAcceptedJuryTerms } from "../app/lib/fotorank/jury/jury-terms";
import { textoDeTerminos } from "../app/lib/fotorank/jury/terminosDelJurado";

async function main() {
  const contestId = process.argv[2];
  const email = process.argv[3];
  if (!contestId || !email) {
    throw new Error("Uso: tsx scripts/probar-terminos-del-jurado.ts <contestId> <email>");
  }

  const { db, esDeClickaton } = await baseDelConcurso(contestId);
  console.log(`Base del concurso: ${esDeClickaton ? "Clickatón" : "FotoRank"}`);

  const texto = textoDeTerminos(esDeClickaton);
  console.log(`\nLo que va a leer el jurado:`);
  console.log(`  "${texto.titulo}"`);
  console.log(`  ${texto.cuerpo}`);
  console.log(`  [ ] ${texto.casilla}   → botón "${texto.boton}"`);
  if (texto.advertencia) console.log(`  aviso a la organización: ${texto.advertencia}`);

  const jurado = await db.fotorankJudgeAccount.findFirst({
    where: { email },
    select: { id: true },
  });
  if (!jurado) throw new Error(`No hay cuenta de jurado para ${email}.`);

  const antes = await hasAcceptedJuryTerms({ judgeAccountId: jurado.id, contestId });
  console.log(`\n¿Ya había aceptado?: ${antes ? "sí" : "no"}`);
  if (antes) {
    console.log("Ya estaba aceptado: no se toca nada.");
    return;
  }

  await acceptJuryTerms({ judgeAccountId: jurado.id, contestId, source: "prueba" });
  const despues = await hasAcceptedJuryTerms({ judgeAccountId: jurado.id, contestId });
  console.log(`✓ Aceptado y leído de vuelta: ${despues ? "sí" : "NO"}`);

  // Deshacer: la aceptación real la tiene que hacer la persona.
  const asignaciones = await db.fotorankJudgeAssignment.findMany({
    where: { judgeAccountId: jurado.id, contestId },
    select: { id: true, methodConfigJson: true },
  });
  for (const a of asignaciones) {
    const cfg = { ...((a.methodConfigJson ?? {}) as Record<string, unknown>) };
    delete cfg.juryTermsAcceptance;
    await db.fotorankJudgeAssignment.update({
      where: { id: a.id },
      data: { methodConfigJson: cfg },
    });
  }
  await db.fotorankJudgeAuditEvent.deleteMany({
    where: { contestId, actorJudgeId: jurado.id, eventType: "JURY_TERMS_ACCEPTED" },
  });
  console.log("✓ Deshecho: el jurado va a tener que aceptar de verdad.");
}

main()
  .catch((error) => {
    console.error("FALLÓ:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
