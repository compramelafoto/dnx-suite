/**
 * Evaluación de DNX Bot contra la API real de Anthropic con herramientas falsas
 * (sólo registran qué se llamó). GASTA DINERO REAL: correr sólo con permiso.
 *   ANTHROPIC_API_KEY=... pnpm --filter compramelafoto bot:eval
 */
import { Anthropic, defineTool, runBotTurn, type BotTool } from "@repo/dnx-bot";
import { z } from "zod";
import { ESCENARIOS } from "../lib/bot/evals/escenarios";
import { buildSystemGuide } from "../lib/bot/guia";

const LECTURA = [
  "ver_album",
  "buscar_pedidos",
  "ver_pedido",
  "estado_mercadopago",
  "ver_tutoriales",
  "abrir_ticket",
  "reportar_problema_del_sistema",
];
const ESCRITURA = [
  "actualizar_album",
  "cambiar_venta_de_foto",
  "configurar_venta_por_reconocimiento",
  "extender_vencimiento",
  "reintentar_subida",
  "crear_pack_digital",
  "editar_pack",
  "actualizar_perfil",
  "actualizar_precios_por_defecto",
  "reenviar_link_de_descarga",
];
const ESCRITURA_SET = new Set(ESCRITURA);

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
    const tools: BotTool[] = [...LECTURA, ...ESCRITURA].map((name) =>
      defineTool({
        name,
        description: `(prueba) ${name}`,
        kind: ESCRITURA_SET.has(name) ? "write" : "read",
        input: z.looseObject({}),
        describe: async () => `(prueba) ${name}`,
        run: async () => {
          usadas.push(name);
          return { ok: true, message: "ok (prueba)" };
        },
      }),
    );
    let texto = "";
    await runBotTurn({
      client: client as never,
      model,
      effort: "medium",
      systemGuide: buildSystemGuide(),
      situation: e.situacion,
      tools,
      actor: { userId: 1, role: "PHOTOGRAPHER", email: "eval@x.com", name: "Eval" },
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
      ...(e.debeUsar ?? []).filter((t) => !usadas.includes(t)).map((t) => `no usó ${t}`),
      ...(e.noDebeUsar ?? []).filter((t) => usadas.includes(t)).map((t) => `usó ${t}`),
      ...(e.textoNoDebeContener ?? []).filter((r) => r.test(texto)).map((r) => `texto contiene ${r}`),
    ];
    if (errores.length) fallas++;
    console.log(
      `${errores.length ? "✗" : "✓"} ${e.id}${errores.length ? ` — ${errores.join("; ")}` : ""}\n   ${texto.replace(/\n/g, " ").slice(0, 200)}`,
    );
  }
  console.log(`\n${ESCENARIOS.length - fallas}/${ESCENARIOS.length} escenarios OK`);
  process.exit(fallas ? 1 : 0);
}
void main();
