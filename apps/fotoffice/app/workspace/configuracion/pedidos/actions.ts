"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { guardarAjustesPedidos } from "@/lib/pedidos/ajustes";
import { guardarPlantillasChecklist } from "@/lib/pedidos/checklist";
import type { CtxPedidos } from "@/lib/pedidos/acceso";

/** Estado del formulario de Configuración → Pedidos (`useActionState`). */
export type EstadoPedidosConfig = { error: string | null; ok?: string };

const RUTA = "/workspace/configuracion/pedidos";
const SIN_PERMISO: EstadoPedidosConfig = { error: "Sólo el dueño o un administrador pueden configurar los pedidos." };
const DATOS_INVALIDOS: EstadoPedidosConfig = { error: "Los datos no son válidos." };

/**
 * Sesión, workspace activo y rol salen siempre de la sesión, nunca del formulario. Sin
 * `configurar` no se lee ni se escribe nada. Como Configuración → Presupuestos, NO exige el
 * módulo encendido: los ajustes se pueden dejar listos antes.
 */
async function contexto(): Promise<CtxPedidos | null> {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role };
}

function texto(fd: FormData, nombre: string): string | null {
  const v = fd.get(nombre);
  return typeof v === "string" ? v : null;
}

/** Días y encendido del recordatorio y rubro de ingreso por omisión. `guardarAjustesPedidos` valida rango y rubro. */
export async function guardarAjustesPedidosAction(_prev: EstadoPedidosConfig | undefined, fd: FormData): Promise<EstadoPedidosConfig> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const dias = texto(fd, "recordatorioDias");
  if (dias === null) return DATOS_INVALIDOS;
  const r = await guardarAjustesPedidos(ctx, {
    recordatorioDias: dias,
    recordatorioActivo: fd.get("recordatorioActivo") === "1",
    rubroIngresoId: texto(fd, "rubroIngresoId") ?? "",
  });
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: "Ajustes guardados." };
}

/**
 * Plantillas de checklist: llegan como JSON en un campo del formulario (`plantillas`) y se validan
 * enteras en el servidor (`validarPlantillas`): topes, nombres y textos. Reemplaza todas.
 */
export async function guardarPlantillasChecklistAction(_prev: EstadoPedidosConfig | undefined, fd: FormData): Promise<EstadoPedidosConfig> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const crudo = texto(fd, "plantillas");
  if (crudo === null || crudo.length > 200_000) return DATOS_INVALIDOS;
  let datos: unknown;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return DATOS_INVALIDOS;
  }
  const r = await guardarPlantillasChecklist(ctx, datos);
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: "Plantillas guardadas." };
}
