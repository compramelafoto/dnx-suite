import { diaDeSemana, esFechaValida, leerHora } from "./fechas";
import { validarFranjas, type FranjaSemanal } from "./horario";

/**
 * La ficha de empleada: lectura del formulario y reglas chicas. Módulo PURO.
 */

/** El valor de la jornada que rige en esa fecha: el último con `desde` igual o anterior. */
export function valorVigente<T extends { desde: string }>(valores: readonly T[], fecha: string): T | null {
  const previos = valores.filter((v) => v.desde <= fecha).sort((a, b) => b.desde.localeCompare(a.desde));
  return previos[0] ?? null;
}

/** Cómo la saludan los mensajes: el apodo, o el primer nombre, o la parte del correo antes de la @. */
export function nombreParaSaludo(p: { apodo: string | null; name: string | null; email: string }): string {
  const apodo = p.apodo?.trim();
  if (apodo) return apodo;
  const primero = p.name?.trim().split(/\s+/)[0];
  if (primero) return primero;
  return p.email.split("@")[0];
}

export const FRANJAS_POR_DIA = 2;

export type DatosFicha = {
  apodo: string | null;
  fechaNacimiento: string | null;
  jornadaMinutos: number;
  activa: boolean;
  sabadosAlternados: boolean;
  sabadoReferencia: string | null;
  franjas: FranjaSemanal[];
};

export type LecturaFicha = { ok: true; datos: DatosFicha } | { ok: false; error: string };

function texto(fd: FormData, campo: string): string {
  return String(fd.get(campo) ?? "").trim();
}

/**
 * Lee el formulario de la ficha. Las franjas viajan como `f-<día>-<n>-inicio` y
 * `f-<día>-<n>-fin` ("08:00"); una franja con las dos horas vacías no existe.
 */
export function leerFormularioFicha(fd: FormData): LecturaFicha {
  const apodo = texto(fd, "apodo").slice(0, 40) || null;

  const nacimiento = texto(fd, "fechaNacimiento") || null;
  if (nacimiento && !esFechaValida(nacimiento)) return { ok: false, error: "La fecha de nacimiento no se entiende." };

  const horasTexto = texto(fd, "jornadaHoras").replace(",", ".") || "5";
  const horas = Number(horasTexto);
  if (!Number.isFinite(horas) || horas <= 0 || horas > 12) {
    return { ok: false, error: "La jornada de referencia tiene que ser de más de 0 y hasta 12 horas." };
  }

  const sabadosAlternados = fd.get("sabadosAlternados") === "on";
  const sabadoReferencia = texto(fd, "sabadoReferencia") || null;
  if (sabadoReferencia && (!esFechaValida(sabadoReferencia) || diaDeSemana(sabadoReferencia) !== 5)) {
    return { ok: false, error: "La fecha de referencia de los sábados tiene que ser un sábado." };
  }

  const franjas: FranjaSemanal[] = [];
  for (let d = 0; d < 7; d++) {
    for (let n = 1; n <= FRANJAS_POR_DIA; n++) {
      const ini = texto(fd, `f-${d}-${n}-inicio`);
      const fin = texto(fd, `f-${d}-${n}-fin`);
      if (!ini && !fin) continue;
      const inicioMin = leerHora(ini);
      const finMin = leerHora(fin);
      if (inicioMin === null || finMin === null) {
        return { ok: false, error: "En cada franja hacen falta la hora de entrada y la de salida." };
      }
      franjas.push({ diaSemana: d, inicioMin, finMin });
    }
  }
  const v = validarFranjas(franjas);
  if (!v.ok) return { ok: false, error: v.error };

  return {
    ok: true,
    datos: {
      apodo,
      fechaNacimiento: nacimiento,
      jornadaMinutos: Math.round(horas * 60),
      activa: fd.get("activa") === "on",
      sabadosAlternados,
      sabadoReferencia,
      franjas: v.franjas,
    },
  };
}

/** Lo que le falta cargar a la ficha, para avisarle al dueño. */
export function datosFaltantes(f: {
  fechaNacimiento: string | null;
  sabadosAlternados: boolean;
  sabadoReferencia: string | null;
  franjas: readonly unknown[];
  valores: readonly unknown[];
}): string[] {
  const faltan: string[] = [];
  if (f.franjas.length === 0) faltan.push("el horario semanal");
  if (f.valores.length === 0) faltan.push("el valor de la jornada");
  if (!f.fechaNacimiento) faltan.push("la fecha de nacimiento");
  if (f.sabadosAlternados && !f.sabadoReferencia) faltan.push("qué sábado arranca");
  return faltan;
}
