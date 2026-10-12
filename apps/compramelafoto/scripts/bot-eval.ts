/**
 * Evaluación de DNX Bot contra la API real de Anthropic con herramientas falsas
 * (sólo registran qué se llamó). GASTA DINERO REAL: correr sólo con permiso.
 *   ANTHROPIC_API_KEY=... pnpm --filter compramelafoto bot:eval
 */
import { Anthropic, runBotTurn, type BotActor, type BotTool } from "@repo/dnx-bot";
import { ESCENARIOS } from "../lib/bot/evals/escenarios";
import { buildSystemGuide } from "../lib/bot/guia";
import { toolsForActor } from "../lib/bot/herramientas";

const ACTOR: BotActor = { userId: 1, role: "PHOTOGRAPHER", email: "eval@x.com", name: "Eval" };

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY. Esta evaluación llama a la API real y cuesta dinero; definila y volvé a correr.");
    process.exit(2);
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.CLF_BOT_MODEL ?? "claude-sonnet-5-5";
  let fallas = 0;
  for (const e of ESCENARIOS) {
    const usadas: string[] = [];
    // Definiciones reales (nombre, descripción, esquema); sólo se reemplaza lo que toca la base.
    const tools: BotTool[] = toolsForActor(ACTOR, { conversationId: "eval" }).map((t) => ({
      ...t,
      ...(t.kind === "write" ? { describe: async () => `(prueba) ${t.name}` } : {}),
      run: async () => {
        usadas.push(t.name);
        return { ok: true, message: "ok (prueba)", data: {} };
      },
    }));
    let texto = "";
    const resultado = await runBotTurn({
      client: client as never,
      model,
      effort: "medium",
      systemGuide: buildSystemGuide(),
      situation: e.situacion,
      tools,
      actor: ACTOR,
      history: [],
      userText: e.mensaje,
      maxIterations: 6,
      onText: (d) => {
        texto += d;
      },
      proposeWrite: async (p) => {
        usadas.push(p.toolName);
        return { actionId: "eval" };
      },
      onProposal: () => {},
    });
    const errores = [
      ...(resultado.outcome !== "ok" ? [`el turno terminó en ${resultado.outcome}`] : []),
      ...(e.debeUsarAlguna && !e.debeUsarAlguna.some((t) => usadas.includes(t)) ? [`no usó ninguna de ${e.debeUsarAlguna.join("/")}`] : []),
      ...(e.debeUsar ?? []).filter((t) => !usadas.includes(t)).map((t) => `no usó ${t}`),
      ...(e.noDebeUsar ?? []).filter((t) => usadas.includes(t)).map((t) => `usó ${t}`),
      ...(e.textoNoDebeContener ?? []).filter((r) => r.test(texto)).map((r) => `texto contiene ${r}`),
    ];
    if (errores.length) fallas++;
    console.log(
      `${errores.length ? "✗" : "✓"} ${e.id} [${usadas.join(", ") || "sin herramientas"}]${errores.length ? ` — ${errores.join("; ")}` : ""}\n   ${texto.replace(/\n/g, " ").slice(0, 200)}`,
    );
  }
  console.log(`\n${ESCENARIOS.length - fallas}/${ESCENARIOS.length} escenarios OK`);
  process.exit(fallas ? 1 : 0);
}
void main();
