import "server-only";
import { prisma } from "@repo/db";
import { DIAS_DESPUES_MAX, DIAS_DESPUES_MIN, DIAS_DESPUES_POR_OMISION, esTablaFaltante } from "./dominio";

export { DIAS_DESPUES_MAX, DIAS_DESPUES_MIN, DIAS_DESPUES_POR_OMISION };

/**
 * Ajustes de Testimonios de cada workspace (`FotofficeTestimonioAjustes`, una fila por workspace):
 * el pedido automático (apagado por omisión), cuántos días después de finalizar el proyecto se
 * pide y si se avisa al equipo cuando entra uno. Sin fila (o sin tabla) valen los de omisión.
 *
 * `encendidoAt` marca desde cuándo está encendido el automático: sólo se invita por proyectos
 * finalizados DESPUÉS de ese momento (encenderlo no le escribe a clientes de hace meses). Se pone
 * cada vez que pasa de apagado a encendido.
 */

export type AjustesTestimonios = {
  automaticoEncendido: boolean;
  diasDespues: number;
  encendidoAt: Date | null;
  avisarAlEquipo: boolean;
};

export const AJUSTES_POR_OMISION: AjustesTestimonios = {
  automaticoEncendido: false,
  diasDespues: DIAS_DESPUES_POR_OMISION,
  encendidoAt: null,
  avisarAlEquipo: true,
};

export const MENSAJE_DIAS = `Elegí entre ${DIAS_DESPUES_MIN} y ${DIAS_DESPUES_MAX} días.`;

export type CambiosAjustes = Pick<AjustesTestimonios, "automaticoEncendido" | "diasDespues" | "avisarAlEquipo">;

/** Valida lo que llega del formulario de ajustes. */
export function validarAjustes(input: { automaticoEncendido?: unknown; diasDespues?: unknown; avisarAlEquipo?: unknown }):
  | { ok: true; datos: CambiosAjustes }
  | { ok: false; error: string } {
  const raw = input.diasDespues;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : Number.NaN;
  if (!Number.isInteger(n) || n < DIAS_DESPUES_MIN || n > DIAS_DESPUES_MAX) return { ok: false, error: MENSAJE_DIAS };
  return {
    ok: true,
    datos: { automaticoEncendido: input.automaticoEncendido === true, diasDespues: n, avisarAlEquipo: input.avisarAlEquipo === true },
  };
}

/** Desde cuándo cuenta el automático después de guardar: se renueva sólo al pasar de apagado a encendido. */
export function encendidoAtDespuesDeGuardar(previo: Pick<AjustesTestimonios, "automaticoEncendido" | "encendidoAt">, encendido: boolean, ahora: Date): Date | null {
  if (!encendido) return previo.encendidoAt;
  if (previo.automaticoEncendido && previo.encendidoAt) return previo.encendidoAt;
  return ahora;
}

export async function leerAjustesTestimonios(workspaceId: string): Promise<AjustesTestimonios> {
  try {
    const f = await prisma.fotofficeTestimonioAjustes.findUnique({
      where: { workspaceId },
      select: { automaticoEncendido: true, diasDespues: true, encendidoAt: true, avisarAlEquipo: true },
    });
    return f ?? AJUSTES_POR_OMISION;
  } catch (err) {
    if (esTablaFaltante(err)) return AJUSTES_POR_OMISION;
    throw err;
  }
}

export async function guardarAjustesTestimonios(workspaceId: string, cambios: CambiosAjustes, ahora: Date = new Date()): Promise<AjustesTestimonios> {
  const previo = await leerAjustesTestimonios(workspaceId);
  const encendidoAt = encendidoAtDespuesDeGuardar(previo, cambios.automaticoEncendido, ahora);
  const datos = { ...cambios, encendidoAt };
  await prisma.fotofficeTestimonioAjustes.upsert({ where: { workspaceId }, create: { workspaceId, ...datos }, update: datos });
  return datos;
}
