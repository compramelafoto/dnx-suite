import type { EstadoAsistencia } from "./asistencia";

/**
 * Planillas de asistencia guardadas en el celular, para tomar lista sin señal.
 *
 * Mismo criterio que la cola de acreditación de Eventos (`lib/eventos/acreditacion/ui`), pero más
 * simple: acá lo que viaja es la planilla entera de un curso y un día, y el servidor la guarda de
 * forma idempotente (de dos versiones de un estudiante gana la anotada después). Reenviarla no
 * duplica nada, así que se puede reintentar sin miedo.
 *
 * Las funciones de fusión y marcado son puras y tienen pruebas; las de `localStorage` no tiran
 * nunca (modo privado, almacenamiento lleno).
 */

export type Registro = { estado: EstadoAsistencia; horaLlegada: string | null; anotadaAt: string };

export type Planilla = {
  cursoId: string;
  fecha: string;
  sinClase: boolean;
  motivo: string | null;
  /** Hora en que llegó la docente. */
  horaDocente?: string | null;
  registros: Record<string, Registro>;
  /** Hay cambios que el servidor todavía no tiene. */
  pendiente: boolean;
  /** Último error del servidor (no de conexión): se muestra y se deja de reintentar solo. */
  error?: string | null;
  /** Cuándo cambió por última vez en este aparato (para «sin clase» y el motivo). */
  cambiadaAt?: string;
};

/**
 * Hora de los «presente» que se completan solos al empezar a tomar lista. Es la más vieja posible
 * a propósito: nunca le gana a una marca real hecha en otro aparato.
 */
export const ANOTADA_POR_DEFECTO = "1970-01-01T00:00:00.000Z";

export const claveDePlanilla = (cursoId: string, fecha: string) => `${cursoId}|${fecha}`;

export function planillaVacia(cursoId: string, fecha: string): Planilla {
  return { cursoId, fecha, sinClase: false, motivo: null, registros: {}, pendiente: false, error: null };
}

const masNueva = (a: Registro | undefined, b: Registro | undefined): Registro | undefined => {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.anotadaAt) >= Date.parse(a.anotadaAt) ? b : a;
};

/**
 * Junta lo que vino del servidor con lo guardado en el aparato. Estudiante por estudiante gana el
 * registro anotado después. Si en el aparato quedó algo sin mandar, sigue pendiente.
 */
export function fusionarPlanilla(servidor: Planilla | undefined, local: Planilla | undefined): Planilla | undefined {
  if (!local) return servidor;
  if (!servidor) return local;
  const ids = new Set([...Object.keys(servidor.registros), ...Object.keys(local.registros)]);
  const registros: Record<string, Registro> = {};
  for (const id of ids) {
    const r = masNueva(servidor.registros[id], local.registros[id]);
    if (r) registros[id] = r;
  }
  return {
    ...servidor,
    sinClase: local.pendiente ? local.sinClase : servidor.sinClase,
    motivo: local.pendiente ? local.motivo : servidor.motivo,
    horaDocente: local.pendiente ? (local.horaDocente ?? null) : (servidor.horaDocente ?? null),
    registros,
    pendiente: local.pendiente,
    error: local.error ?? null,
    cambiadaAt: local.cambiadaAt,
  };
}

/**
 * Marca a un estudiante. Si es la primera marca de la planilla, los demás quedan presentes (con la
 * hora por defecto): se toma lista tocando sólo a los que faltan.
 */
export function marcar(
  planilla: Planilla,
  estudiantes: readonly string[],
  estudianteId: string,
  estado: EstadoAsistencia,
  ahora: Date,
  horaLlegada: string | null,
): Planilla {
  const registros = { ...planilla.registros };
  if (Object.keys(registros).length === 0) {
    for (const id of estudiantes) registros[id] = { estado: "PRESENTE", horaLlegada: null, anotadaAt: ANOTADA_POR_DEFECTO };
  }
  registros[estudianteId] = { estado, horaLlegada: estado === "TARDE" ? horaLlegada : null, anotadaAt: ahora.toISOString() };
  return { ...planilla, registros, pendiente: true, error: null, cambiadaAt: ahora.toISOString() };
}

/** «Todos presentes»: completa a quien no tenga marca, sin tocar lo ya marcado. */
export function completarPresentes(planilla: Planilla, estudiantes: readonly string[], ahora: Date): Planilla {
  const registros = { ...planilla.registros };
  for (const id of estudiantes) {
    if (!registros[id]) registros[id] = { estado: "PRESENTE", horaLlegada: null, anotadaAt: ANOTADA_POR_DEFECTO };
  }
  return { ...planilla, registros, pendiente: true, error: null, cambiadaAt: ahora.toISOString() };
}

/** Cambia la hora de llegada de quien está «tarde» (cuenta como una marca nueva). */
export function cambiarHora(planilla: Planilla, estudianteId: string, hora: string, ahora: Date): Planilla {
  const r = planilla.registros[estudianteId];
  if (!r || r.estado !== "TARDE") return planilla;
  return {
    ...planilla,
    registros: { ...planilla.registros, [estudianteId]: { ...r, horaLlegada: hora, anotadaAt: ahora.toISOString() } },
    pendiente: true,
    error: null,
    cambiadaAt: ahora.toISOString(),
  };
}

export function marcarSinClase(planilla: Planilla, sinClase: boolean, motivo: string | null, ahora: Date): Planilla {
  return { ...planilla, sinClase, motivo: sinClase ? motivo : null, pendiente: true, error: null, cambiadaAt: ahora.toISOString() };
}

export function marcarHoraDocente(planilla: Planilla, hora: string | null, ahora: Date): Planilla {
  return { ...planilla, horaDocente: hora, pendiente: true, error: null, cambiadaAt: ahora.toISOString() };
}

/** Lo que se manda al servidor. */
export function cuerpoDeEnvio(p: Planilla) {
  return {
    cursoId: p.cursoId,
    fecha: p.fecha,
    sinClase: p.sinClase,
    motivo: p.motivo,
    horaDocente: p.horaDocente ?? null,
    registros: Object.entries(p.registros).map(([estudianteId, r]) => ({ estudianteId, ...r })),
  };
}

/**
 * Al volver la respuesta: si mientras viajaba se tocó algo más (cambió `cambiadaAt`), sigue
 * pendiente para el próximo envío; si no, queda al día.
 */
export function alConfirmarEnvio(actual: Planilla, enviada: Planilla): Planilla {
  if (actual.cambiadaAt !== enviada.cambiadaAt) return actual;
  return { ...actual, pendiente: false, error: null };
}

export function resumen(p: Planilla | undefined, estudiantes: readonly string[]): Record<EstadoAsistencia, number> & { sinMarcar: number } {
  const out = { PRESENTE: 0, AUSENTE: 0, TARDE: 0, RETIRO: 0, JUSTIFICADA: 0, sinMarcar: 0 };
  for (const id of estudiantes) {
    const r = p?.registros[id];
    if (r) out[r.estado] += 1;
    else out.sinMarcar += 1;
  }
  return out;
}

// ── Guardado en el aparato ───────────────────────────────────────────────────────────────────

const PREFIJO = "fotoffice:registro-docente:asistencia:v1:";

export function leerPlanillasLocales(): Planilla[] {
  try {
    const out: Planilla[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIJO)) continue;
      const p = JSON.parse(localStorage.getItem(k) ?? "null") as Planilla | null;
      if (p && typeof p.cursoId === "string" && typeof p.fecha === "string" && p.registros) out.push(p);
    }
    return out;
  } catch {
    return [];
  }
}

export function guardarPlanillaLocal(p: Planilla): void {
  try {
    const k = PREFIJO + claveDePlanilla(p.cursoId, p.fecha);
    // Lo que ya está en el servidor no hace falta tenerlo en el aparato.
    if (p.pendiente) localStorage.setItem(k, JSON.stringify(p));
    else localStorage.removeItem(k);
  } catch {
    // Sin almacenamiento (modo privado): la planilla vive mientras la pantalla esté abierta.
  }
}
