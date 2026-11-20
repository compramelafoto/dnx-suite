/**
 * Cuestionarios para clientes: cómo es uno por dentro. Módulo PURO (sin base ni React).
 *
 * Un cuestionario es DATOS, no código: secciones con preguntas, cada una con un id estable. Así un
 * estudio puede sumar los suyos más adelante sin tocar el programa. Los ids no cambian nunca:
 * con ellos se recuperan las respuestas para corregirlas. Las etiquetas sí pueden cambiar, por eso
 * cada respuesta guarda la etiqueta tal como estaba cuando el cliente la contestó.
 */

/** corto = una línea · largo = párrafo · fecha = día del calendario · telefono = número. */
export type TipoPregunta = "corto" | "largo" | "fecha" | "telefono";

export const TIPOS_PREGUNTA: readonly TipoPregunta[] = ["corto", "largo", "fecha", "telefono"];

export type Pregunta = {
  id: string;
  etiqueta: string;
  tipo: TipoPregunta;
  descripcion?: string;
};

export type Seccion = {
  id: string;
  titulo: string;
  descripcion?: string;
  preguntas: Pregunta[];
};

export type DefinicionCuestionario = {
  secciones: Seccion[];
};

/** Lo que se guarda por cada pregunta contestada. */
export type RespuestaGuardada = {
  preguntaId: string;
  etiqueta: string;
  seccion: string;
  valor: string;
};

export type EstadoEnvio = "PENDIENTE" | "RESPONDIDO";

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Lee una definición guardada en la base sin confiar en ella: lo que no tiene forma de sección o
 * de pregunta se descarta, un tipo desconocido pasa a «corto» y un id repetido se ignora (el
 * segundo pisaría la respuesta del primero).
 */
export function leerDefinicion(crudo: unknown): DefinicionCuestionario {
  const obj = crudo && typeof crudo === "object" ? (crudo as Record<string, unknown>) : {};
  const secciones = Array.isArray(obj.secciones) ? obj.secciones : [];
  const vistos = new Set<string>();
  const salida: Seccion[] = [];
  for (const s of secciones) {
    if (!s || typeof s !== "object") continue;
    const sec = s as Record<string, unknown>;
    const titulo = texto(sec.titulo);
    const preguntas: Pregunta[] = [];
    for (const p of Array.isArray(sec.preguntas) ? sec.preguntas : []) {
      if (!p || typeof p !== "object") continue;
      const pr = p as Record<string, unknown>;
      const id = texto(pr.id);
      const etiqueta = texto(pr.etiqueta);
      if (!id || !etiqueta || vistos.has(id)) continue;
      vistos.add(id);
      const tipo = TIPOS_PREGUNTA.includes(pr.tipo as TipoPregunta) ? (pr.tipo as TipoPregunta) : "corto";
      const descripcion = texto(pr.descripcion);
      preguntas.push({ id, etiqueta, tipo, ...(descripcion ? { descripcion } : {}) });
    }
    if (preguntas.length === 0) continue;
    const descripcion = texto(sec.descripcion);
    salida.push({
      id: texto(sec.id) || `seccion-${salida.length + 1}`,
      titulo: titulo || "Preguntas",
      ...(descripcion ? { descripcion } : {}),
      preguntas,
    });
  }
  return { secciones: salida };
}

/** Lee las respuestas guardadas (JSON de la base) sin confiar en su forma. */
export function leerRespuestasGuardadas(crudo: unknown): RespuestaGuardada[] {
  if (!Array.isArray(crudo)) return [];
  const salida: RespuestaGuardada[] = [];
  for (const r of crudo) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const preguntaId = texto(o.preguntaId);
    const valor = texto(o.valor);
    if (!preguntaId || !valor) continue;
    salida.push({ preguntaId, etiqueta: texto(o.etiqueta) || preguntaId, seccion: texto(o.seccion), valor });
  }
  return salida;
}

/** Las respuestas guardadas como `{ preguntaId: valor }`, para volver a llenar el formulario. */
export function valoresIniciales(respuestas: RespuestaGuardada[]): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const r of respuestas) salida[r.preguntaId] = r.valor;
  return salida;
}
