"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { AlboomApiError, AlboomLoginError, crearClienteAlboom } from "@/lib/alboom/client";
import {
  borrarCredencialAlboom,
  conectarAlboom,
  leerCredencialAlboom,
  marcarAlboomParaReconectar,
  marcarAlboomUsada,
  resumenConexionAlboom,
} from "@/lib/alboom/credenciales";
import { borrarLoExtraido, cancelarExtraccion, iniciarExtraccion } from "@/lib/alboom/extracciones";
import { cancelarCargaAlboom, cargarAlboom, simularAlboom } from "@/lib/alboom/carga/servidor";
import { IntegrationsVaultError } from "@/lib/integrations/vault";
import { sanitizeError } from "@/lib/payments/connect/log";
import type { EstadoAlboom } from "./estado";

const RUTA = "/workspace/configuracion/alboom";
const SIN_PERMISO: EstadoAlboom = { error: "Sólo el dueño o un administrador pueden migrar desde Alboom." };
const SIN_CONEXION: EstadoAlboom = { error: "Primero conectá la cuenta de Alboom." };

/**
 * Sesión, workspace activo y rol salen siempre de la sesión, nunca del formulario. Sin `configurar` (dueño o
 * administrador) no se lee ni se escribe nada. La contraseña de Alboom entra por `conectarAlboomAction` y no
 * vuelve nunca: ni en el resultado, ni en los registros.
 */
async function contexto() {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) return null;
  return { workspaceId: workspace.id, userId: user.id };
}

function texto(fd: FormData, nombre: string, max: number): string | null {
  const v = fd.get(nombre);
  if (typeof v !== "string" || v.length > max) return null;
  return v;
}

function errorDeConexion(error: unknown): EstadoAlboom {
  if (error instanceof AlboomLoginError) return { error: "Alboom rechazó el usuario o la contraseña." };
  if (error instanceof IntegrationsVaultError) return { error: "Falta configurar el cifrado de credenciales en el servidor." };
  if (error instanceof AlboomApiError && error.message === "Faltan datos para conectar Alboom") {
    return { error: "Completá el subdominio, el usuario y la contraseña." };
  }
  if (error instanceof AlboomApiError && error.message === "Subdominio de Alboom inválido") return { error: "El subdominio no es válido." };
  return { error: "No se pudo hablar con Alboom. Probá de nuevo en unos minutos." };
}

/** Conecta (o vuelve a conectar) la cuenta: prueba el inicio de sesión y recién ahí la guarda cifrada. */
export async function conectarAlboomAction(_prev: EstadoAlboom | undefined, fd: FormData): Promise<EstadoAlboom> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const subdomain = texto(fd, "subdomain", 200);
  const username = texto(fd, "username", 200);
  const password = texto(fd, "password", 200);
  if (subdomain === null || username === null || password === null) return { error: "Los datos no son válidos." };
  try {
    await conectarAlboom(ctx.workspaceId, ctx.userId, { subdomain, username, password });
  } catch (error) {
    // Nunca la contraseña: sólo el tipo de error.
    console.error("[fotoffice][alboom] no se pudo conectar", { workspaceId: ctx.workspaceId, detalle: error instanceof Error ? error.name : "desconocido" });
    return errorDeConexion(error);
  }
  revalidatePath(RUTA);
  return { error: null, ok: "Cuenta de Alboom conectada." };
}

/** Inicia sesión con la credencial guardada. Si Alboom la rechaza, queda marcada para volver a conectar. */
export async function probarConexionAction(_prev: EstadoAlboom | undefined, _fd: FormData): Promise<EstadoAlboom> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const cred = await leerCredencialAlboom(ctx.workspaceId);
  if (!cred) return SIN_CONEXION;
  try {
    await crearClienteAlboom(cred);
  } catch (error) {
    if (error instanceof AlboomLoginError) {
      await marcarAlboomParaReconectar(ctx.workspaceId);
      revalidatePath(RUTA);
    }
    return errorDeConexion(error);
  }
  await marcarAlboomUsada(ctx.workspaceId);
  revalidatePath(RUTA);
  return { error: null, ok: "La conexión con Alboom funciona." };
}

/** Borra la credencial y cancela la extracción en curso. Lo ya extraído queda (se borra aparte). */
export async function desconectarAlboomAction(_prev: EstadoAlboom | undefined, _fd: FormData): Promise<EstadoAlboom> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  try {
    await cancelarExtraccion(ctx.workspaceId);
    await borrarCredencialAlboom(ctx.workspaceId);
  } catch (error) {
    console.error("[fotoffice][alboom] no se pudo desconectar", { workspaceId: ctx.workspaceId, detalle: sanitizeError(error) });
    return { error: "No se pudo desconectar. Probá de nuevo." };
  }
  revalidatePath(RUTA);
  return { error: null, ok: "Cuenta de Alboom desconectada." };
}

/** "Extraer todo" o "Volver a extraer": deja la extracción pendiente; la corre el cron en tandas. */
export async function extraerAction(_prev: EstadoAlboom | undefined, fd: FormData): Promise<EstadoAlboom> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const modo = fd.get("modo") === "INCREMENTAL" ? "INCREMENTAL" : "TODO";
  const conexion = await resumenConexionAlboom(ctx.workspaceId);
  if (!conexion) return SIN_CONEXION;
  if (conexion.estado !== "ACTIVE") return { error: "Hay que volver a conectar la cuenta de Alboom antes de extraer." };
  const r = await iniciarExtraccion(ctx.workspaceId, ctx.userId, modo);
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: "Listo: la extracción arranca en los próximos minutos y sigue sola en segundo plano." };
}

export async function cancelarExtraccionAction(_prev: EstadoAlboom | undefined, _fd: FormData): Promise<EstadoAlboom> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const hubo = await cancelarExtraccion(ctx.workspaceId);
  revalidatePath(RUTA);
  return hubo ? { error: null, ok: "Extracción cancelada. Lo ya extraído queda guardado." } : { error: "No hay una extracción en curso." };
}

/** Borra los datos crudos y el historial de extracciones. Pide escribir BORRAR. */
export async function borrarLoExtraidoAction(_prev: EstadoAlboom | undefined, fd: FormData): Promise<EstadoAlboom> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  if (String(fd.get("confirmacion") ?? "").trim().toUpperCase() !== "BORRAR") return { error: "Escribí BORRAR para confirmar." };
  const r = await borrarLoExtraido(ctx.workspaceId);
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: `Se borraron ${r.registros.toLocaleString("es-AR")} registros extraídos.` };
}

// ── Etapa 8B-1: cargar en FOTOFFICE ─────────────────────────────────────────

/** "Simular": arma el informe de lo que se cargaría, sin escribir nada. Las partes elegidas llegan como `entidad`. */
export async function simularCargaAction(_prev: EstadoAlboom | undefined, fd: FormData): Promise<EstadoAlboom> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const elegidas = fd.getAll("entidad").filter((v): v is string => typeof v === "string" && v.length <= 40);
  if (elegidas.length === 0) return { error: "Elegí al menos una parte para simular." };
  const r = await simularAlboom(ctx.workspaceId, ctx.userId, elegidas);
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: "Listo: la simulación arranca en los próximos minutos. No cambia nada en FotoOffice." };
}

/** "Cargar": sólo con una simulación vigente (la verifica el servidor de nuevo) y escribiendo CARGAR. */
export async function cargarAction(_prev: EstadoAlboom | undefined, fd: FormData): Promise<EstadoAlboom> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  if (String(fd.get("confirmacion") ?? "").trim().toUpperCase() !== "CARGAR") return { error: "Escribí CARGAR para confirmar." };
  const r = await cargarAlboom(ctx.workspaceId, ctx.userId);
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: "Listo: la carga arranca en los próximos minutos y sigue sola en segundo plano." };
}

export async function cancelarCargaAction(_prev: EstadoAlboom | undefined, _fd: FormData): Promise<EstadoAlboom> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const hubo = await cancelarCargaAlboom(ctx.workspaceId);
  revalidatePath(RUTA);
  return hubo ? { error: null, ok: "Cancelada. Lo que ya se cargó queda cargado (volver a cargar no lo duplica)." } : { error: "No hay una simulación ni una carga en curso." };
}
