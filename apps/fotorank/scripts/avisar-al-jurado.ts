/**
 * Le avisa al jurado que ya puede calificar.
 *
 * Por omisión no manda nada: imprime a quién le escribiría y con qué texto.
 * Sale de verdad sólo con `--aplicar`, porque del otro lado hay personas.
 *
 *   DATABASE_URL=<FotoRank> CLICKATON_JURY_DATABASE_URL=<Clickatón> \
 *   CLICKATON_JURY_MEDIA_SECRET=... RESEND_API_KEY=... \
 *   pnpm --filter @repo/db exec tsx \
 *     ../../apps/fotorank/scripts/avisar-al-jurado.ts <contestId> [--recordatorio] [--aplicar]
 */
import {
  planDeAviso,
  type AvisoParaUnJurado,
} from "../app/lib/fotorank/jury/avisarAlJurado";

/** Dónde entra el jurado. El dominio se puede cambiar sin tocar el código. */
const ENLACE =
  process.env.FOTORANK_PUBLIC_URL?.trim().replace(/\/$/, "") ??
  "https://www.fotorank.com";

async function mandar(a: AvisoParaUnJurado): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return "sin RESEND_API_KEY";
  if (!a.correo) return "sin correo armado";

  const from =
    process.env.FOTORANK_EMAIL_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "FotoRank <noreply@fotorank.com>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [a.email],
      subject: a.correo.asunto,
      text: a.correo.texto,
      html: a.correo.html,
    }),
  });
  if (!res.ok) return `falló (${res.status}) ${await res.text()}`;
  const cuerpo = (await res.json()) as { id?: string };
  return `enviado ${cuerpo.id ?? ""}`.trim();
}

async function main() {
  const contestId = process.argv[2];
  if (!contestId) throw new Error("Falta el contestId.");
  const que = process.argv.includes("--recordatorio")
    ? "RECORDATORIO"
    : "ABIERTO";
  const aplicar = process.argv.includes("--aplicar");

  const plan = await planDeAviso({
    contestId,
    que,
    enlace: `${ENLACE}/jurado/panel`,
  });

  console.log(`\nConcurso: ${plan.concurso}`);
  console.log(
    `Aviso: ${que === "ABIERTO" ? "ya podés calificar" : "recordatorio"}`,
  );
  console.log(`Enlace: ${ENLACE}/jurado/panel`);
  console.log(`Jurados con asignación viva: ${plan.destinatarios.length}\n`);

  const seMandan = plan.destinatarios.filter((d) => d.correo);
  const salteados = plan.destinatarios.filter((d) => !d.correo);

  for (const d of salteados) {
    console.log(
      `  ○ ${d.email || d.judgeAccountId} — no se le manda: ${d.seSaltea}`,
    );
  }
  for (const d of seMandan) {
    console.log(
      `  ● ${d.email} — ${d.obras} obras, ${d.consignas} consignas, ` +
        `${d.criterios} criterios, le faltan ${d.faltan}`,
    );
  }

  const primero = seMandan[0];
  if (primero?.correo) {
    console.log("\n" + "─".repeat(74));
    console.log("Así se lee (el de " + primero.email + "):");
    console.log("─".repeat(74));
    console.log("Asunto: " + primero.correo.asunto);
    console.log("");
    console.log(primero.correo.texto);
    console.log("─".repeat(74));
  }

  if (!aplicar) {
    console.log(
      `\nEnsayo. No se mandó nada. Con --aplicar salen ${seMandan.length}.\n`,
    );
    return;
  }

  console.log(`\nMandando ${seMandan.length}…\n`);
  for (const d of seMandan) {
    const r = await mandar(d);
    console.log(`  ${d.email}: ${r}`);
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
