"use server";

import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import {
  crearEnvio,
  datosDeCuestionariosDelCliente,
  type DatosDeCuestionariosDelCliente,
  type ResultadoCrearEnvio,
} from "@/lib/cuestionarios/cuestionarios-servidor";

/**
 * Cuestionarios para clientes, desde el panel. Mandar uno pide «Gestionar» en Clientes (es la
 * misma regla que editar la ficha); ver las respuestas pide «Ver».
 *
 * A diferencia de `requireClientsEditor`, acá no se redirige: el diálogo muestra el error.
 */

async function contexto(nivel: "VIEW" | "MANAGE") {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return null;
  const level = await getModuleLevel(user.id, workspace.id, CLIENTS_MODULE_KEY);
  if (!hasLevel(level, nivel)) return null;
  return { user, workspace };
}

function idValido(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);
}

/** Prepara el enlace de un cuestionario para un cliente y devuelve los enlaces listos para mandar. */
export async function crearEnvioCuestionarioAction(clientId: string, cuestionarioId: string): Promise<ResultadoCrearEnvio> {
  if (!idValido(clientId) || !idValido(cuestionarioId)) return { ok: false, error: "Faltan datos para preparar el cuestionario." };
  const ctx = await contexto("MANAGE");
  if (!ctx) return { ok: false, error: "No tenés permiso para mandar cuestionarios a clientes." };
  return crearEnvio({
    workspaceId: ctx.workspace.id,
    clientId,
    cuestionarioId,
    userId: String(ctx.user.id),
  });
}

/** Los cuestionarios mandados a un cliente, con su estado y sus respuestas. */
export async function listarCuestionariosDelClienteAction(clientId: string): Promise<DatosDeCuestionariosDelCliente | null> {
  if (!idValido(clientId)) return null;
  const ctx = await contexto("VIEW");
  if (!ctx) return null;
  return datosDeCuestionariosDelCliente(ctx.workspace.id, clientId);
}
