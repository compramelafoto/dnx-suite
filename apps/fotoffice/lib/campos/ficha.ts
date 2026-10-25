import "server-only";
import { cache } from "react";
import { puede, puedeEnContexto } from "@/lib/access/policy";
import { moduloDeTipo } from "@/lib/access/modulos-crm";
import { moduloDeRegistroEncendido } from "./modulos";
import { contextoDeCampos, type ContextoCampos } from "./acceso";
import type { TipoRegistroActivo } from "./constantes";
import { esTipoRegistroActivo, listarCampos } from "./definiciones";
import { asegurarCamposIniciales } from "./semillas";
import { cambiosDe, registroDelWorkspace, valoresDe } from "./valores";
import { vistaDeCampo, type CambioVista, type CampoVista } from "./vista";

/**
 * Sesión, workspace, rol y slug: lecturas puras del pedido, resueltas una sola vez aunque la
 * página tenga más de una tarjeta.
 */
const contextoDelPedido = cache(contextoDeCampos);

/**
 * Guarda de "Más datos": sesión, workspace de la sesión, rol que opera, módulo del tipo
 * encendido y registro del mismo workspace. Devuelve null ante cualquier falta, sin
 * distinguir el motivo. Nada de los valores se lee antes de pasar por acá.
 */
export async function contextoDeMasDatos(entityType: unknown, entityId: unknown): Promise<ContextoCampos | null> {
  if (!esTipoRegistroActivo(entityType)) return null;
  if (typeof entityId !== "string" || !entityId || entityId.length > 100) return null;
  const ctx = await contextoDelPedido();
  if (!ctx) return null;
  if (!(await moduloDeRegistroEncendido(ctx.workspaceId, entityType))) return null;
  if (!puedeEnContexto(ctx, "ver", moduloDeTipo(entityType))) return null;
  if (!(await registroDelWorkspace(ctx.workspaceId, entityType, entityId))) return null;
  return ctx;
}

export type MasDatosVista = {
  campos: CampoVista[];
  puedeEditar: boolean;
  puedeConfigurar: boolean;
};

/**
 * Los campos activos del tipo, en su orden, con el valor del registro. Primero la guarda;
 * en la ficha de un cliente, antes de leer, se asegura el campo inicial de DNX (idempotente;
 * para los demás workspaces no hace nada).
 */
export async function cargarMasDatos(entityType: TipoRegistroActivo, entityId: string): Promise<MasDatosVista | null> {
  const ctx = await contextoDeMasDatos(entityType, entityId);
  if (!ctx) return null;
  if (entityType === "CLIENTE") await asegurarCamposIniciales(ctx.workspaceId, ctx.workspaceSlug);
  const campos = await listarCampos(ctx.workspaceId, entityType);
  const valores = campos.length > 0 ? await valoresDe(ctx.workspaceId, entityType, [entityId]) : new Map();
  const delRegistro = valores.get(entityId);
  return {
    campos: campos.map((c) => vistaDeCampo(c, delRegistro?.get(c.id) ?? null)),
    puedeEditar: puedeEnContexto(ctx, "operar", moduloDeTipo(entityType)),
    puedeConfigurar: puede(ctx.role, "configurar"),
  };
}

/** Tope de cambios de "Más datos" que se intercalan en el historial de una consulta. */
export const CAMBIOS_EN_HISTORIAL = 100;

/**
 * Cambios de "Más datos" de una consulta, para su historial. Quien llama ya verificó que la
 * consulta es del workspace de la sesión (`cargarFicha` acotada a `workspace.id`); igual se
 * filtra por workspace y tipo.
 */
export async function cambiosDeConsulta(workspaceId: string, consultaId: string): Promise<CambioVista[]> {
  const { cambios } = await cambiosDe(workspaceId, "CONSULTA", consultaId, { take: CAMBIOS_EN_HISTORIAL });
  return cambios.map((c) => ({
    id: c.id,
    fecha: c.createdAt.toISOString(),
    quien: c.actorLabel || "Sistema",
    campo: c.campo,
    antes: c.antes ?? "vacío",
    despues: c.despues ?? "vacío",
  }));
}
