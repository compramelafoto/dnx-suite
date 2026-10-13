/**
 * Evaluación de DNX Bot en FOTOFFICE contra la API real de Anthropic, con las herramientas reales
 * cuyo run/describe sólo registran qué se llamó (spec §10). GASTA DINERO REAL (≈ USD 1 por corrida
 * completa): correr sólo con permiso de Daniel.
 *   ANTHROPIC_API_KEY=... pnpm --filter fotoffice bot:eval
 * Un solo caso: BOT_EVAL_ID=<id>.
 */
import { Anthropic, runBotTurn, type BotActor, type BotTool } from "@repo/dnx-bot";
import type { CtxBot } from "../lib/dnx-bot/acceso";
import { ESCENARIOS, fallasDeEntrada, type Escenario, type LlamadaRegistrada } from "../lib/dnx-bot/evals/escenarios";
import { guiaDelBot } from "../lib/dnx-bot/guia";
import { herramientasPara } from "../lib/dnx-bot/herramientas";

const ACTOR: BotActor = { userId: 1, role: "WORKSPACE_OWNER", email: "eval@x.test", name: "Eval" };

function ctxDe(e: Escenario): CtxBot {
  const capacidades = { configurar: true, gestionarPresupuestos: true, verConsultas: true, ...e.capacidades };
  return {
    workspaceId: "eval",
    workspaceNombre: "Estudio de prueba",
    userId: ACTOR.userId,
    userLabel: "Eval",
    role: capacidades.configurar ? "WORKSPACE_OWNER" : "STAFF",
    email: ACTOR.email,
    nombre: ACTOR.name,
    capacidades,
    plataforma: "FOTOFFICE:eval",
  };
}

async function main() {
  const filtro = process.env.BOT_EVAL_ID?.trim();
  const escenarios = filtro ? ESCENARIOS.filter((e) => e.id === filtro) : ESCENARIOS;
  if (escenarios.length === 0) {
    console.log("No hay escenarios para correr todavía: no se llamó a la API.");
    process.exit(0);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY. Esta evaluación llama a la API real y cuesta dinero; definila y volvé a correr.");
    process.exit(2);
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.FOTOFFICE_BOT_MODEL ?? "claude-sonnet-5-5";
  let fallas = 0;
  for (const e of escenarios) {
    const llamadas: LlamadaRegistrada[] = [];
    // Definiciones reales (nombre, descripción, esquema); sólo se reemplaza lo que toca la base.
    const tools: BotTool[] = herramientasPara(ctxDe(e)).map((t) => ({
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
      effort: "medium",
      systemGuide: guiaDelBot(),
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
