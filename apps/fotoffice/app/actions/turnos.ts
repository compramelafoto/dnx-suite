"use server";

import { revalidatePath } from "next/cache";
import { contextoDeAgenda } from "@/lib/agenda/contexto";
import { MENSAJES_TURNOS } from "@/lib/turnos/constantes";
import { guardarAjustesTurnos, guardarConfigTurnoTipo, type Resultado } from "@/lib/turnos/configurar";

// Configuración de los turnos de servicio. Cada acción arma el contexto de la Agenda y la lógica exige
// `configurar` (dueño o administrador) antes de escribir.

export async function guardarConfigTurnoTipoAction(tipoId: string, datos: unknown): Promise<Resultado> {
  const ctx = await contextoDeAgenda("operar");
  if (!ctx) return { ok: false, error: MENSAJES_TURNOS.sinPermiso };
  const r = await guardarConfigTurnoTipo(ctx, tipoId, datos);
  if (r.ok) {
    revalidatePath("/workspace/configuracion/agenda/tipos");
    revalidatePath(`/workspace/configuracion/agenda/tipos/${tipoId}`);
  }
  return r;
}

export async function guardarAjustesTurnosAction(datos: unknown): Promise<Resultado> {
  const ctx = await contextoDeAgenda("operar");
  if (!ctx) return { ok: false, error: MENSAJES_TURNOS.sinPermiso };
  const r = await guardarAjustesTurnos(ctx, datos);
  if (r.ok) revalidatePath("/workspace/configuracion/agenda/turnos");
  return r;
}
