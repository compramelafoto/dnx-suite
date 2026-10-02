import "server-only";
import { cache } from "react";
import { puede } from "@/lib/access/policy";
import { moduloDeRegistroEncendido } from "@/lib/campos/modulos";
import { registroDelWorkspace } from "@/lib/campos/valores";
import { normalizeWhatsappNumber } from "@/lib/contact/whatsapp";
import { contextoDePlantillas, type ContextoPlantillas } from "./acceso";
import { correoValido, destinoDe, esTipoFichaMensaje, type TipoFichaMensaje } from "./contexto";
import { listarPlantillas } from "./definiciones";
import { MENSAJES_ENVIO } from "./envio";
import { asegurarPlantillasIniciales } from "./semillas";
import type { PanelMensaje, PlantillaOpcion } from "./vista-mensaje";

/** Sesión, workspace, rol y slug: resueltos una sola vez por pedido. */
const contextoDelPedido = cache(contextoDePlantillas);

/**
 * Guarda del panel "Mensaje" de una ficha: tipo e id con forma válida, sesión y workspace de la
 * sesión con `operar`, módulo del tipo encendido y registro del mismo workspace. null ante
 * cualquier falta, sin distinguir el motivo. Nada se lee antes de pasar por acá.
 */
export async function contextoDelPanelMensaje(entityType: unknown, entityId: unknown): Promise<ContextoPlantillas | null> {
  if (!esTipoFichaMensaje(entityType)) return null;
  if (typeof entityId !== "string" || !entityId || entityId.length > 100) return null;
  const ctx = await contextoDelPedido();
  if (!ctx || !puede(ctx.role, "operar")) return null;
  if (!(await moduloDeRegistroEncendido(ctx.workspaceId, entityType))) return null;
  if (!(await registroDelWorkspace(ctx.workspaceId, entityType, entityId))) return null;
  return ctx;
}

/**
 * Datos del botón "Mensaje": primero la guarda; después se aseguran las plantillas iniciales
 * (idempotente, como al abrir Configuración → Plantillas) y se leen las del canal para la ficha
 * (las de su tipo más las GENERAL, activas) y adónde puede ir cada canal.
 */
export async function cargarPanelMensaje(entityType: TipoFichaMensaje, entityId: string): Promise<PanelMensaje | null> {
  const ctx = await contextoDelPanelMensaje(entityType, entityId);
  if (!ctx) return null;
  await asegurarPlantillasIniciales(ctx.workspaceId, ctx.workspaceSlug);
  const [destino, deCorreo, deWhatsapp] = await Promise.all([
    destinoDe(ctx.workspaceId, entityType, entityId),
    listarPlantillas(ctx.workspaceId, { canal: "EMAIL", tipo: entityType }),
    listarPlantillas(ctx.workspaceId, { canal: "WHATSAPP", tipo: entityType }),
  ]);
  if (!destino) return null;
  const opciones = (ps: typeof deCorreo): PlantillaOpcion[] =>
    ps.map((p) => ({ id: p.id, nombre: p.name, general: p.entityType === "GENERAL" }));
  const correo = correoValido(destino.email) ? destino.email : null;
  const telefono = normalizeWhatsappNumber(destino.telefono) ? destino.telefono : null;
  return {
    correo: { destino: correo, motivo: correo ? null : MENSAJES_ENVIO.sinCorreo, plantillas: opciones(deCorreo) },
    whatsapp: { destino: telefono, motivo: telefono ? null : MENSAJES_ENVIO.sinWhatsapp, plantillas: opciones(deWhatsapp) },
  };
}
