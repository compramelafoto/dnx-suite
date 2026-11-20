import type { DefinicionCuestionario, RespuestaGuardada, TipoPregunta } from "./tipos";

/**
 * Validar y ordenar lo que manda el cliente desde el enlace público. Módulo PURO.
 *
 * Lo que llega del navegador no se cree: sólo cuentan los ids de preguntas que existen en la
 * definición, todo se recorta, cada tipo tiene su largo máximo y una fecha tiene que ser un día
 * que exista. Ninguna pregunta es obligatoria (como en el Google Forms de antes), pero un envío
 * completamente vacío no sirve y se rechaza.
 */

export const LARGO_MAXIMO: Record<TipoPregunta, number> = {
  corto: 300,
  largo: 5000,
  fecha: 10,
  telefono: 40,
};

/** Tope de lo que puede pesar un envío entero (en caracteres del JSON), antes de mirarlo. */
export const TOPE_ENVIO = 200_000;

export type ErrorDeRespuesta = { preguntaId: string; mensaje: string };

export type ResultadoNormalizado =
  | { ok: true; respuestas: RespuestaGuardada[] }
  | { ok: false; errores: ErrorDeRespuesta[]; mensaje: string };

/** `AAAA-MM-DD` de un día que existe (lo que manda un `<input type="date">`). */
export function esFechaValida(valor: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return false;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (anio < 1900 || anio > 2200) return false;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/** Un teléfono escrito a mano: dígitos y los signos de siempre, con al menos 6 dígitos. */
export function esTelefonoValido(valor: string): boolean {
  if (!/^[\d\s+().\-/]+$/.test(valor)) return false;
  return valor.replace(/\D/g, "").length >= 6;
}

/** Junta los espacios de más de una línea; en los párrafos respeta los saltos de línea. */
function limpiar(valor: string, tipo: TipoPregunta): string {
  const sinControl = valor.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
  if (tipo === "largo") {
    return sinControl
      .split("\n")
      .map((l) => l.replace(/[ \t]+/g, " ").trimEnd())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return sinControl.replace(/\s+/g, " ").trim();
}

export function normalizarRespuestas(definicion: DefinicionCuestionario, crudo: unknown): ResultadoNormalizado {
  const entrada = crudo && typeof crudo === "object" && !Array.isArray(crudo) ? (crudo as Record<string, unknown>) : {};
  const respuestas: RespuestaGuardada[] = [];
  const errores: ErrorDeRespuesta[] = [];

  for (const seccion of definicion.secciones) {
    for (const p of seccion.preguntas) {
      const bruto = entrada[p.id];
      if (typeof bruto !== "string") continue;
      const valor = limpiar(bruto, p.tipo);
      if (!valor) continue;
      if (valor.length > LARGO_MAXIMO[p.tipo]) {
        errores.push({ preguntaId: p.id, mensaje: `«${p.etiqueta}» es demasiado largo (hasta ${LARGO_MAXIMO[p.tipo]} caracteres).` });
        continue;
      }
      if (p.tipo === "fecha" && !esFechaValida(valor)) {
        errores.push({ preguntaId: p.id, mensaje: `«${p.etiqueta}» no es una fecha válida.` });
        continue;
      }
      if (p.tipo === "telefono" && !esTelefonoValido(valor)) {
        errores.push({ preguntaId: p.id, mensaje: `«${p.etiqueta}» no parece un número de teléfono.` });
        continue;
      }
      respuestas.push({ preguntaId: p.id, etiqueta: p.etiqueta, seccion: seccion.titulo, valor });
    }
  }

  if (errores.length > 0) {
    return { ok: false, errores, mensaje: errores.length === 1 ? errores[0].mensaje : "Revisá las respuestas marcadas." };
  }
  if (respuestas.length === 0) {
    return { ok: false, errores: [], mensaje: "Completá al menos una respuesta antes de enviar." };
  }
  return { ok: true, respuestas };
}

/** `2026-03-14` → `14/03/2026`, para mostrar. Cualquier otra cosa queda como está. */
export function fechaParaMostrar(valor: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

export type GrupoDeRespuestas = { seccion: string; items: { preguntaId: string; etiqueta: string; valor: string }[] };

/**
 * Las respuestas agrupadas por sección, en el orden en que se contestaron. Si se pasa la
 * definición, las fechas se muestran como día/mes/año.
 */
export function agruparPorSeccion(respuestas: RespuestaGuardada[], definicion?: DefinicionCuestionario): GrupoDeRespuestas[] {
  const fechas = new Set<string>();
  for (const s of definicion?.secciones ?? []) for (const p of s.preguntas) if (p.tipo === "fecha") fechas.add(p.id);

  const grupos: GrupoDeRespuestas[] = [];
  const porNombre = new Map<string, GrupoDeRespuestas>();
  for (const r of respuestas) {
    const nombre = r.seccion || "Respuestas";
    let grupo = porNombre.get(nombre);
    if (!grupo) {
      grupo = { seccion: nombre, items: [] };
      porNombre.set(nombre, grupo);
      grupos.push(grupo);
    }
    grupo.items.push({
      preguntaId: r.preguntaId,
      etiqueta: r.etiqueta,
      valor: fechas.has(r.preguntaId) ? fechaParaMostrar(r.valor) : r.valor,
    });
  }
  return grupos;
}
