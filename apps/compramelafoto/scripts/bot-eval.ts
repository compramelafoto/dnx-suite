/**
 * Evaluación de DNX Bot (fotógrafos y compradores) contra la API real de Anthropic con las
 * herramientas reales cuyo run/describe sólo registran qué se llamó. GASTA DINERO REAL: correr sólo con permiso.
 *   ANTHROPIC_API_KEY=... pnpm --filter compramelafoto bot:eval
 * Sólo una audiencia: BOT_EVAL_AUDIENCIA=comprador (o fotografo).
 */
import { Anthropic, runBotTurn, type BotActor, type BotTool } from "@repo/dnx-bot";
import { buildBuyerGuide } from "../lib/bot/comprador/guia";
import { herramientasComprador } from "../lib/bot/comprador/herramientas";
import { ACTOR_MOTOR_COMPRADOR } from "../lib/bot/comprador/identidad";
import { ESCENARIOS, fallasDeEntrada, type Escenario, type LlamadaRegistrada } from "../lib/bot/evals/escenarios";
import { buildSystemGuide } from "../lib/bot/guia";
import { toolsForActor } from "../lib/bot/herramientas";

const ACTOR: BotActor = { userId: 1, role: "PHOTOGRAPHER", email: "eval@x.com", name: "Eval" };

/** Guía, herramientas reales, actor y parámetros del motor según a quién atiende el escenario. */
function configuracion(e: Escenario): { systemGuide: string; tools: BotTool[]; actor: BotActor; effort: "low" | "medium"; maxIterations: number } {
  if (e.audiencia === "comprador") {
    const tools = herramientasComprador(
      {
        guestKey: "0".repeat(32),
        ipHash: "eval",
        conversationId: "eval",
        pagina: null,
        pagePath: null,
        albumId: null,
        enlace: null,
        emailVerificado: null,
        userId: null,
        ...e.actorComprador,
      },
      {},
    );
    return { systemGuide: buildBuyerGuide(), tools, actor: ACTOR_MOTOR_COMPRADOR, effort: "low", maxIterations: 5 };
  }
  return { systemGuide: buildSystemGuide(), tools: toolsForActor(ACTOR, { conversationId: "eval" }), actor: ACTOR, effort: "medium", maxIterations: 6 };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY. Esta evaluación llama a la API real y cuesta dinero; definila y volvé a correr.");
    process.exit(2);
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.CLF_BOT_MODEL ?? "claude-sonnet-5-5";
  const audiencia = process.env.BOT_EVAL_AUDIENCIA;
  if (audiencia && audiencia !== "comprador" && audiencia !== "fotografo") {
    console.error(`BOT_EVAL_AUDIENCIA inválida: ${audiencia} (usar comprador o fotografo).`);
    process.exit(2);
  }
  const escenarios = audiencia ? ESCENARIOS.filter((e) => (e.audiencia ?? "fotografo") === audiencia) : ESCENARIOS;
  let fallas = 0;
  for (const e of escenarios) {
    const llamadas: LlamadaRegistrada[] = [];
    const config = configuracion(e);
    // Definiciones reales (nombre, descripción, esquema); sólo se reemplaza lo que toca la base.
    const tools: BotTool[] = config.tools.map((t) => ({
      ...t,
      ...(t.kind === "write" ? { describe: async () => `(prueba) ${t.name}` } : {}),
      run: async (input) => {
        llamadas.push({ herramienta: t.name, entrada: input });
        return { ok: true, message: "ok (prueba)", data: {} };
      },
    }));
    let texto = "";
    const resultado = await runBotTurn({
      client: client as never,
      model,
      effort: config.effort,
      systemGuide: config.systemGuide,
      situation: e.situacion,
      tools,
      actor: config.actor,
      history: [],
      userText: e.mensaje,
      maxIterations: config.maxIterations,
      onText: (d) => {
        texto += d;
      },
      proposeWrite: async (p) => {
        llamadas.push({ herramienta: p.toolName, entrada: p.input });
        return { actionId: "eval" };
      },
      onProposal: () => {},
    });
    const usadas = llamadas.map((l) => l.herramienta);
    const errores = [
      ...(resultado.outcome !== "ok" ? [`el turno terminó en ${resultado.outcome}`] : []),
      ...(e.debeUsarAlguna && !e.debeUsarAlguna.some((t) => usadas.includes(t)) ? [`no usó ninguna de ${e.debeUsarAlguna.join("/")}`] : []),
      ...(e.debeUsar ?? []).filter((t) => !usadas.includes(t)).map((t) => `no usó ${t}`),
      ...(e.noDebeUsar ?? []).filter((t) => usadas.includes(t)).map((t) => `usó ${t}`),
      ...(e.textoNoDebeContener ?? []).filter((r) => r.test(texto)).map((r) => `texto contiene ${r}`),
      ...fallasDeEntrada(e, llamadas),
    ];
    if (errores.length) fallas++;
    console.log(
      `${errores.length ? "✗" : "✓"} ${e.id} [${usadas.join(", ") || "sin herramientas"}]${errores.length ? ` — ${errores.join("; ")}` : ""}\n   ${texto.replace(/\n/g, " ").slice(0, 200)}`,
    );
  }
  console.log(`\n${escenarios.length - fallas}/${escenarios.length} escenarios OK`);
  process.exit(fallas ? 1 : 0);
}
void main();
