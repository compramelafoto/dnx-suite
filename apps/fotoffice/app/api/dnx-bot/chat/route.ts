import { windowHistory, type BotActor } from "@repo/dnx-bot";
import { resolverBot } from "@/lib/dnx-bot/acceso";
import { avisoDePrivacidad } from "@/lib/dnx-bot/aviso-privacidad";
import { AVISO_CIFRA, cifrasNoRespaldadas, cifrasPermitidas, textosDelTurno } from "@/lib/dnx-bot/cifras";
import { leerConfigBot } from "@/lib/dnx-bot/config";
import { leerContexto } from "@/lib/dnx-bot/contexto";
import { revalidarContexto } from "@/lib/dnx-bot/contexto-validado";
import { guiaDelBot } from "@/lib/dnx-bot/guia";
import { herramientasPara } from "@/lib/dnx-bot/herramientas";
import { estadoDelPerfil } from "@/lib/dnx-bot/herramientas/perfil";
import { reportarCifraNoRespaldada } from "@/lib/dnx-bot/incidentes";
import { decidirLimites } from "@/lib/dnx-bot/limites";
import { armarSituacion } from "@/lib/dnx-bot/situacion";
import { continuarConversacion, crearAccionPendiente, registrarUso, usoActual } from "@/lib/dnx-bot/store";
import { avisarTopes } from "@/lib/dnx-bot/tope";
import { respuestaDeTurno } from "@/lib/dnx-bot/turno-sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Margen para no arrancar otra vuelta con el modelo cerca del límite de la función (120 s). */
const PRESUPUESTO_DEL_TURNO_MS = 95_000;

/**
 * Un turno de DNX Bot en FOTOFFICE (SSE). Todo sale de la sesión (`resolverBot`): el workspace,
 * los permisos y la plataforma. Del cuerpo sólo se toman el texto, la página y el contexto saneado.
 */
export async function POST(req: Request) {
  const deadlineMs = Date.now() + PRESUPUESTO_DEL_TURNO_MS;
  const puertas = await resolverBot();
  if (!puertas.ok) return new Response("No encontrado", { status: 404 });
  const ctx = puertas.ctx;

  const body = (await req.json().catch(() => null)) as { text?: unknown; pagePath?: unknown; contexto?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 2000) : "";
  if (!text) return new Response("Mensaje vacío", { status: 400 });
  const pagePath = typeof body?.pagePath === "string" ? body.pagePath.slice(0, 200) : null;
  const contexto = leerContexto(body?.contexto, pagePath);

  const cfg = leerConfigBot();
  const actor: BotActor = { userId: ctx.userId!, role: ctx.role ?? "", email: ctx.email, name: ctx.nombre };
  const userId = actor.userId;
  // Para el aviso de privacidad: el historial (¿ya se habló del perfil?) y una sola vez por turno.
  let historial: unknown[] = [];
  let avisado = false;
  return respuestaDeTurno({
    model: cfg.model,
    effort: cfg.effort,
    maxIterations: cfg.maxIterations,
    deadlineMs,
    text,
    plataforma: ctx.plataforma,
    verificarLimites: async () => {
      const d = decidirLimites(cfg.limits, await usoActual({ plataforma: ctx.plataforma, userId }));
      return d.permitido ? null : d.mensaje;
    },
    preparar: async () => {
      // La conversación sigue entera (nunca se corta en silencio); al modelo va una ventana de los
      // últimos turnos, y lo anterior, resumido en la situación.
      const conv = await continuarConversacion({ plataforma: ctx.plataforma, userId, pagePath, model: cfg.model });
      const ventana = windowHistory(conv.mensajes);
      // Del borrador del perfil, la situación cuenta sólo lo anotado antes de lo que el modelo ve del historial.
      const borradorHasta = ventana.start > 0 ? conv.fechas[ventana.start]! : conv.creada;
      const [perfil, enPantalla] = await Promise.all([estadoDelPerfil(ctx, { borradorHasta }), revalidarContexto(ctx, contexto)]);
      return {
        conversationId: conv.id,
        history: ventana.messages,
        // Entero: el aviso de privacidad y las cifras miran toda la conversación, no sólo la ventana.
        historialCompleto: (historial = conv.mensajes),
        systemGuide: guiaDelBot(),
        situation: armarSituacion({
          rol: ctx.role,
          capacidades: ctx.capacidades,
          contexto,
          workspaceNombre: ctx.workspaceNombre,
          perfil,
          enPantalla,
          antes: ventana.summary,
        }),
        tools: herramientasPara(ctx),
        actor,
      };
    },
    registrarUso: (conversationId, usage, costMicroUsd) =>
      registrarUso({ plataforma: ctx.plataforma, userId, conversationId, usage, costMicroUsd, contarMensaje: true }),
    proponer: (conversationId, w) => crearAccionPendiente({ plataforma: ctx.plataforma, conversationId, userId, ...w }),
    // Las tarjetas las pinta la burbuja con los datos del servidor, nunca con el texto del modelo.
    alResultado: (send, name, outcome) => {
      // El aviso de privacidad lo muestra FOTOFFICE tal cual (no lo escribe el modelo), una vez por conversación.
      if (!avisado) {
        const aviso = avisoDePrivacidad({ historial, pantalla: contexto.pantalla, textoUsuario: text, herramienta: name, resultado: outcome });
        if (aviso) {
          avisado = true;
          send("aviso", aviso);
        }
      }
      const tarjeta = outcome.ok ? (outcome.data as { tarjeta?: unknown } | undefined)?.tarjeta : undefined;
      if ((name === "simular_perfil" || name === "anotar_en_borrador" || name === "cotizar_trabajo") && tarjeta) send("calculo", tarjeta);
      if (name === "preparar_mensaje" && tarjeta) send("mensaje", tarjeta);
    },
    // Red de seguridad (spec §5.4): toda cifra del texto tiene que salir de una herramienta o de la persona.
    revisarRespuesta: async ({ texto, appended, history, conversationId }) => {
      const permitidas = cifrasPermitidas([...textosDelTurno(history), ...textosDelTurno(appended)]);
      const malas = cifrasNoRespaldadas(texto, permitidas);
      if (malas.length === 0) return null;
      await reportarCifraNoRespaldada({ plataforma: ctx.plataforma, ids: { userId, conversationId }, cantidad: malas.length }).catch(
        (e: unknown) => console.error("[dnx-bot] cifra no respaldada", e),
      );
      return AVISO_CIFRA;
    },
    idsDeIncidente: (conversationId) => ({ userId, conversationId }),
    despuesDelTurno: () => avisarTopes({ workspaceId: ctx.workspaceId }),
  });
}
