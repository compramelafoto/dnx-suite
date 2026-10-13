/**
 * Evaluación de DNX Bot en FOTOFFICE contra la API real de Anthropic (spec §10). GASTA DINERO REAL
 * (≈ USD 1 por corrida completa): correr sólo con permiso de Daniel.
 *   ANTHROPIC_API_KEY=... pnpm --filter fotoffice bot:eval
 * Un solo caso: BOT_EVAL_ID=<id>.
 *
 * Las herramientas de lectura corren de verdad sobre un perfil de prueba (sin base); las de
 * escritura sólo registran la propuesta. Además de lo que pide cada escenario, toda cifra del
 * texto tiene que salir del mensaje o de un resultado de herramienta.
 */
import { Anthropic, runBotTurn, type BotActor, type BotTool } from "@repo/dnx-bot";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import type { CtxBot } from "../lib/dnx-bot/acceso";
import {
  CONSULTAS_DE_PRUEBA,
  ESCENARIOS,
  fallasDeCifras,
  fallasDeEntrada,
  fallasDeEntradaEnAlguna,
  fallasDeTexto,
  type Escenario,
  type LlamadaRegistrada,
} from "../lib/dnx-bot/evals/escenarios";
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

function herramientasDe(e: Escenario): BotTool[] {
  const perfil = e.perfil === "completo" ? createBaseCompleteProfile() : null;
  const leer = async () => (perfil ? { perfil, source: "manual", actualizado: new Date() } : null);
  const nunca = async (): Promise<never> => {
    throw new Error("bot:eval nunca escribe");
  };
  const consultas = e.consultas ? CONSULTAS_DE_PRUEBA[e.consultas] : [];
  let n = 0;
  return herramientasPara(ctxDe(e), {
    perfil: { leer, guardar: nunca },
    presupuestos: {
      leerPerfil: leer,
      buscarConsultas: async () => consultas,
      consulta: async (_c, id) => {
        const k = consultas.find((x) => x.leadId === id);
        return k ? { ...k, categoriaId: null } : null;
      },
      leerPresupuesto: async () => null,
      crearPresupuesto: nunca,
      guardarBorrador: nunca,
      itemsDePropuestaModelo: async () => 0,
      nuevaClave: () => `eval${++n}`,
    },
  });
}

async function main() {
  const filtro = process.env.BOT_EVAL_ID?.trim();
  const escenarios = filtro ? ESCENARIOS.filter((e) => e.id === filtro) : ESCENARIOS;
  if (escenarios.length === 0) {
    console.log("No hay escenarios para correr: no se llamó a la API.");
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
    const salidas: string[] = [];
    const tools: BotTool[] = herramientasDe(e).map((t) =>
      t.kind === "write"
        ? { ...t, describe: async () => `(prueba) ${t.name}`, run: async () => ({ ok: true, message: "ok (prueba)" }) }
        : {
            ...t,
            run: async (input, actor) => {
              llamadas.push({ herramienta: t.name, entrada: input });
              const out = await t.run(input, actor);
              salidas.push(JSON.stringify(out));
              return out;
            },
          },
    );
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
      ...fallasDeTexto(e, texto),
      ...fallasDeCifras(e, texto, salidas),
      ...fallasDeEntrada(e, llamadas),
      ...fallasDeEntradaEnAlguna(e, llamadas),
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
