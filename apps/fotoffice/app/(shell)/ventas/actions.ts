"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sanitizeError } from "@/lib/payments/connect/log";
import { requireSalesAssistantManager } from "@/lib/sales-assistant/access";
import {
  AlboomApiError,
  AlboomLoginError,
  crearClienteAlboom,
} from "@/lib/sales-assistant/alboom/client";
import {
  borrarCredencialAlboom,
  guardarCredencialAlboom,
  leerCredencialAlboom,
  resumenConexionAlboom,
} from "@/lib/sales-assistant/alboom/credentials";
import { RESULTADOS } from "@/lib/sales-assistant/constants";
import {
  ajustesSchema,
  conexionSchema,
  embudosElegidos,
  mensajeConexionGuardada,
  minutosParaActualizar,
  primerError,
  puedeReanalizar,
  sugerenciaEditable,
} from "@/lib/sales-assistant/panel";
import {
  archivar,
  detalleOportunidad,
  guardarAjustes,
  leerAjustes,
  referenciaOportunidad,
  referenciaSugerencia,
  registrarSeguimiento,
  resolverSugerencia,
} from "@/lib/sales-assistant/repository";
import { sincronizarWorkspace, type ResumenSync } from "@/lib/sales-assistant/sync";

/**
 * Las acciones de `/ventas`. Todas empiezan por `requireSalesAssistantManager`: una Server Action
 * se puede llamar con un POST directo, sin pasar por la pantalla, así que el permiso se mira acá
 * y no en el botón.
 *
 * Ninguna habla con Prisma: todo pasa por `repository.ts` y `credentials.ts`, que llevan el
 * `workspaceId` en cada consulta (lo verifica `lib/sales-assistant/aislamiento.test.ts`).
 *
 * Nada de lo que devuelven estas acciones lleva la contraseña de Alboom: ni en el estado, ni en
 * los mensajes de error, ni en lo que se registra.
 */

export type PanelState = { error: string | null; ok: string | null; warn?: string | null };

/**
 * La corrida manual tiene que entrar en el `maxDuration = 300` de la página que la llama. El plazo
 * cuenta desde que arranca `sincronizarWorkspace` (login y lectura de Alboom incluidos); el margen
 * que queda hasta 300 s es para el análisis que ya estaba en curso cuando se cumplió.
 */
const PLAZO_CORRIDA_MS = 180_000;

const NO_ENCONTRADA = "No encontramos esa oportunidad.";
const YA_CAMBIO = "Esta sugerencia ya cambió; actualizá la página.";

/** El nombre visible de quien actúa, igual que en Coberturas. */
function etiquetaDe(user: { name: string | null; email: string }): string {
  return user.name ?? user.email;
}

function revalidarVentas(opportunityId?: string) {
  revalidatePath("/ventas");
  if (opportunityId) revalidatePath(`/ventas/${opportunityId}`);
}

function registrarFallo(que: string, error: unknown) {
  // Saneado como pide el spec (§9): ni la credencial, ni la cookie de Alboom, ni el texto de los
  // mensajes a clientes pueden terminar en un log.
  console.error(`[fotoffice][ventas] ${que}`, { detalle: sanitizeError(error) });
}

// ---------------------------------------------------------------------------------------------
// Conexión con Alboom
// ---------------------------------------------------------------------------------------------

/**
 * Guarda la conexión con Alboom, pero sólo después de probarla.
 *
 * Guardar primero y probar después dejaría una credencial rota marcada como activa, y el cron de
 * mañana fallaría sin que nadie esté mirando. Si la contraseña viene vacía y ya había una
 * guardada, se conserva: la pantalla nunca la vuelve a mostrar, así que no se le puede pedir a la
 * persona que la reescriba cada vez que cambia otro dato.
 */
export async function guardarConexionAction(
  _prev: PanelState | undefined,
  formData: FormData,
): Promise<PanelState> {
  const { user, workspace } = await requireSalesAssistantManager();

  const parsed = conexionSchema.safeParse({
    subdomain: formData.get("subdomain")?.toString() ?? "",
    username: formData.get("username")?.toString() ?? "",
    password: formData.get("password")?.toString() ?? "",
  });
  if (!parsed.success) return { error: primerError(parsed.error), ok: null };

  let password = parsed.data.password;
  if (password === "") {
    const guardada = await leerCredencialAlboom(workspace.id);
    if (!guardada) return { error: "Falta la contraseña de Alboom.", ok: null };
    // La guardada sólo vale para la MISMA cuenta: con otro usuario o subdominio sería probar la
    // contraseña de una cuenta contra otra.
    if (
      guardada.subdomain.toLowerCase() !== parsed.data.subdomain ||
      guardada.username.trim().toLowerCase() !== parsed.data.username.toLowerCase()
    ) {
      return { error: "Ingresá la contraseña de nuevo.", ok: null };
    }
    password = guardada.password;
  }
  const cred = { subdomain: parsed.data.subdomain, username: parsed.data.username, password };

  let embudos: string[];
  let abiertas: number;
  try {
    const cliente = await crearClienteAlboom(cred);
    embudos = [...new Set((await cliente.embudos()).map((e) => e.trim()).filter(Boolean))];
    abiertas = (await cliente.listarAbiertas()).length;
  } catch (error) {
    if (error instanceof AlboomLoginError) {
      return { error: "Alboom rechazó el usuario o la contraseña", ok: null };
    }
    if (error instanceof AlboomApiError) {
      return {
        error: "No pudimos hablar con Alboom. Revisá el subdominio y probá de nuevo en un rato.",
        ok: null,
      };
    }
    registrarFallo("no se pudo probar la conexión", error);
    return { error: "No pudimos probar la conexión. Probá de nuevo.", ok: null };
  }

  await guardarCredencialAlboom(workspace.id, cred, user.id);
  revalidatePath("/ventas/configuracion");
  revalidarVentas();

  return { error: null, ok: mensajeConexionGuardada(embudos, abiertas) };
}

export async function desconectarAlboomAction(): Promise<PanelState> {
  const { workspace } = await requireSalesAssistantManager();
  await borrarCredencialAlboom(workspace.id);
  revalidatePath("/ventas/configuracion");
  revalidarVentas();
  return { error: null, ok: "Listo: Alboom quedó desconectado. Las oportunidades ya leídas siguen acá." };
}

// ---------------------------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------------------------

export async function guardarAjustesAction(
  _prev: PanelState | undefined,
  formData: FormData,
): Promise<PanelState> {
  const { workspace } = await requireSalesAssistantManager();

  const parsed = ajustesSchema.safeParse({
    pipelinesIncluded: embudosElegidos(formData.getAll("pipelinesIncluded")),
    signature: formData.get("signature")?.toString() ?? "",
    voiceNotes: formData.get("voiceNotes")?.toString() ?? "",
    waitDays: formData.get("waitDays")?.toString() ?? "",
    staleDays: formData.get("staleDays")?.toString() ?? "",
  });
  if (!parsed.success) return { error: primerError(parsed.error), ok: null };

  await guardarAjustes(workspace.id, parsed.data);
  revalidatePath("/ventas/configuracion");
  revalidarVentas();

  return {
    error: null,
    ok: "Guardado. Se usa desde la próxima sincronización.",
    warn:
      parsed.data.pipelinesIncluded.length === 0
        ? "No elegiste ningún embudo: hasta que marques uno, el asistente no trae oportunidades."
        : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Sincronizar
// ---------------------------------------------------------------------------------------------

function estadoDeCorrida(r: ResumenSync): PanelState {
  switch (r.estado) {
    case "OK":
      return { error: null, ok: r.mensaje ?? "Listo." };
    case "PARCIAL":
      return {
        error: null,
        ok: r.mensaje ?? "Listo.",
        warn:
          r.pendientes > 0
            ? `Quedaron ${r.pendientes} sin analizar; se completan en la próxima sincronización.`
            : "Algunas oportunidades no se pudieron leer o analizar del todo.",
      };
    case "ERROR_LOGIN":
      return { error: "Alboom rechazó el usuario. Revisá la conexión en Configuración.", ok: null };
    case "ERROR_ALBOOM":
      return { error: "No se pudo leer Alboom. Probá de nuevo en un rato.", ok: null };
  }
}

export async function actualizarAhoraAction(): Promise<PanelState> {
  const { workspace } = await requireSalesAssistantManager();

  if (!(await resumenConexionAlboom(workspace.id))) {
    return { error: "Todavía no conectaste Alboom. Hacelo en Configuración.", ok: null };
  }
  const ajustes = await leerAjustes(workspace.id);
  const espera = minutosParaActualizar(ajustes.lastSyncAt, new Date());
  if (espera > 0) {
    return {
      error: `Se actualizó hace muy poco. Esperá ${espera === 1 ? "1 minuto" : `${espera} minutos`} y probá de nuevo.`,
      ok: null,
    };
  }

  let resumen: ResumenSync;
  try {
    resumen = await sincronizarWorkspace(workspace.id, { deadlineMs: PLAZO_CORRIDA_MS });
  } catch (error) {
    registrarFallo("falló la sincronización manual", error);
    return { error: "No pudimos actualizar. Probá de nuevo en un rato.", ok: null };
  }
  revalidarVentas();
  return estadoDeCorrida(resumen);
}

/** Vuelve a analizar UNA oportunidad aunque no haya cambiado nada en Alboom. */
export async function reanalizarAction(opportunityId: string): Promise<PanelState> {
  const { workspace } = await requireSalesAssistantManager();
  const id = z.string().min(1).max(64).safeParse(opportunityId);
  if (!id.success) return { error: NO_ENCONTRADA, ok: null };

  const detalle = await detalleOportunidad(workspace.id, id.data);
  if (!detalle) return { error: NO_ENCONTRADA, ok: null };
  if (!puedeReanalizar(detalle.sugerencias[0]?.creadaEn ?? null, new Date())) {
    return { error: "Ya se analizó recién; probá en un par de minutos.", ok: null };
  }

  let resumen: ResumenSync;
  try {
    // Lee Alboom (para analizarla con lo último) pero analiza sólo ésta: las demás que también
    // tocaría analizar esperan a la corrida diaria o a "Actualizar ahora".
    resumen = await sincronizarWorkspace(workspace.id, {
      forzarIds: [detalle.oportunidad.idExterno],
      soloForzadas: true,
      deadlineMs: PLAZO_CORRIDA_MS,
    });
  } catch (error) {
    registrarFallo("falló el reanálisis", error);
    return { error: "No pudimos volver a analizarla. Probá de nuevo en un rato.", ok: null };
  }
  revalidarVentas(id.data);
  return estadoDeCorrida(resumen);
}

// ---------------------------------------------------------------------------------------------
// Lo que se hace con cada tarjeta
// ---------------------------------------------------------------------------------------------

const idSchema = z.string().trim().min(1).max(64);

/**
 * Anota que se abrió WhatsApp con este mensaje. No manda nada: el mensaje lo envía la persona
 * desde su teléfono; esto sólo deja la bitácora al día.
 *
 * Si ya estaba marcada como enviada (dos toques seguidos al botón), no se duplica el seguimiento.
 */
export async function marcarEnviadaAction(suggestionId: string, mensajeFinal: string): Promise<PanelState> {
  const { user, workspace } = await requireSalesAssistantManager();
  const parsed = z
    .object({ suggestionId: idSchema, mensaje: z.string().trim().min(1, "El mensaje está vacío.").max(4000) })
    .safeParse({ suggestionId, mensaje: mensajeFinal });
  if (!parsed.success) return { error: primerError(parsed.error), ok: null };

  const sugerencia = await referenciaSugerencia(workspace.id, parsed.data.suggestionId);
  if (!sugerencia) return { error: "No encontramos esa sugerencia.", ok: null };
  if (sugerencia.estado === "ENVIADA") return { error: null, ok: "Ya estaba anotado como enviado." };
  if (!sugerenciaEditable(sugerencia.estado)) return { error: YA_CAMBIO, ok: null };

  const mensaje = parsed.data.mensaje;
  const cambio = mensaje !== (sugerencia.mensaje ?? "").trim();
  const ahora = new Date();

  await resolverSugerencia(
    workspace.id,
    sugerencia.id,
    "ENVIADA",
    cambio ? { editedMessage: mensaje } : {},
    ahora,
  );
  await registrarSeguimiento(workspace.id, sugerencia.opportunityId, {
    kind: "MENSAJE_ENVIADO",
    text: mensaje,
    suggestionId: sugerencia.id,
    actorUserId: user.id,
    actorLabel: etiquetaDe(user),
  });
  // Sin `revalidatePath` a propósito: revalidar desde una acción repinta la bandeja en el acto,
  // y la tarjeta (ya ENVIADA) saltaría a «Esperando» antes de que se pudiera marcar qué contestó.
  // Se refresca al registrar el resultado o al volver a entrar (la página es dinámica).
  return { error: null, ok: "Anotado. Cuando te conteste, marcá qué dijo." };
}

export async function registrarResultadoAction(
  opportunityId: string,
  suggestionId: string | null,
  outcome: string,
  texto: string,
): Promise<PanelState> {
  const { user, workspace } = await requireSalesAssistantManager();
  const parsed = z
    .object({
      opportunityId: idSchema,
      suggestionId: idSchema.nullable(),
      outcome: z.enum(RESULTADOS),
      texto: z
        .string()
        .trim()
        .max(2000, "La respuesta es muy larga.")
        .transform((s) => (s === "" ? null : s)),
    })
    .safeParse({ opportunityId, suggestionId, outcome, texto });
  if (!parsed.success) return { error: primerError(parsed.error), ok: null };

  const ref = await referenciaOportunidad(workspace.id, parsed.data.opportunityId);
  if (!ref) return { error: NO_ENCONTRADA, ok: null };

  // La sugerencia es opcional, pero si viene tiene que ser de ESTA oportunidad: si no, el
  // seguimiento quedaría colgado de la historia de otra.
  let sugerenciaId: string | null = null;
  if (parsed.data.suggestionId) {
    const s = await referenciaSugerencia(workspace.id, parsed.data.suggestionId);
    if (!s || s.opportunityId !== ref.id) return { error: "No encontramos esa sugerencia.", ok: null };
    sugerenciaId = s.id;
  }

  await registrarSeguimiento(workspace.id, ref.id, {
    kind: "RESULTADO",
    outcome: parsed.data.outcome,
    text: parsed.data.texto,
    suggestionId: sugerenciaId,
    actorUserId: user.id,
    actorLabel: etiquetaDe(user),
  });
  revalidarVentas(ref.id);
  return { error: null, ok: "Anotado. Lo tengo en cuenta para la próxima sugerencia." };
}

export async function posponerAction(suggestionId: string, dias: number): Promise<PanelState> {
  const { workspace } = await requireSalesAssistantManager();
  const parsed = z
    .object({ suggestionId: idSchema, dias: z.union([z.literal(1), z.literal(3), z.literal(7)]) })
    .safeParse({ suggestionId, dias });
  if (!parsed.success) return { error: "Se puede posponer 1, 3 o 7 días.", ok: null };

  const sugerencia = await referenciaSugerencia(workspace.id, parsed.data.suggestionId);
  if (!sugerencia) return { error: "No encontramos esa sugerencia.", ok: null };
  if (!sugerenciaEditable(sugerencia.estado)) return { error: YA_CAMBIO, ok: null };

  await resolverSugerencia(workspace.id, sugerencia.id, "POSPUESTA", { posponerDias: parsed.data.dias }, new Date());
  revalidarVentas(sugerencia.opportunityId);
  return {
    error: null,
    ok: parsed.data.dias === 1 ? "Pospuesta hasta mañana." : `Pospuesta ${parsed.data.dias} días.`,
  };
}

export async function descartarAction(suggestionId: string): Promise<PanelState> {
  const { workspace } = await requireSalesAssistantManager();
  const id = idSchema.safeParse(suggestionId);
  if (!id.success) return { error: "No encontramos esa sugerencia.", ok: null };

  const sugerencia = await referenciaSugerencia(workspace.id, id.data);
  if (!sugerencia) return { error: "No encontramos esa sugerencia.", ok: null };
  if (!sugerenciaEditable(sugerencia.estado)) return { error: YA_CAMBIO, ok: null };

  await resolverSugerencia(workspace.id, sugerencia.id, "DESCARTADA", {}, new Date());
  revalidarVentas(sugerencia.opportunityId);
  return { error: null, ok: "Sugerencia descartada." };
}

/** Archivar sólo la saca del asistente: en Alboom no cambia nada. */
export async function archivarAction(opportunityId: string, archivarla: boolean): Promise<PanelState> {
  const { workspace } = await requireSalesAssistantManager();
  const parsed = z.object({ id: idSchema, archivar: z.boolean() }).safeParse({ id: opportunityId, archivar: archivarla });
  if (!parsed.success) return { error: NO_ENCONTRADA, ok: null };

  const ref = await referenciaOportunidad(workspace.id, parsed.data.id);
  if (!ref) return { error: NO_ENCONTRADA, ok: null };

  await archivar(workspace.id, ref.id, parsed.data.archivar);
  revalidarVentas(ref.id);
  return {
    error: null,
    ok: parsed.data.archivar
      ? "Archivada en el asistente. En Alboom sigue igual."
      : "Volvió a la bandeja.",
  };
}
