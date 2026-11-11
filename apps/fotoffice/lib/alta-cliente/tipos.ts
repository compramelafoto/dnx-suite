/**
 * El formulario de alta de un cliente nuevo: los tipos de pregunta y cómo se decide qué se
 * muestra. Puro, sin base ni React.
 *
 * Un cuestionario es una lista de secciones; cada sección, una lista de preguntas. Las preguntas
 * viven en código (`cuestionarios/`), así que sumar o cambiar una no pide migración: en la base
 * sólo se guardan las respuestas, por id de pregunta.
 */

export type Opcion = { valor: string; etiqueta: string; ayuda?: string };

/**
 * Mostrar la pregunta sólo si otra respuesta vale algo, no vale algo, o incluye algo (si es de
 * varias opciones). Sin ninguna de las tres: si la otra está respondida.
 */
export type Condicion = { pregunta: string; igualA?: string | boolean; distintoDe?: string; incluye?: string };

type Base = {
  id: string;
  titulo: string;
  ayuda?: string;
  obligatoria?: boolean;
  mostrarSi?: Condicion | Condicion[];
};

export type CampoDeLista =
  | { id: string; titulo: string; tipo: "texto" | "parrafo" | "dinero" | "numero" | "enlace"; ayuda?: string }
  | { id: string; titulo: string; tipo: "opcion"; opciones: Opcion[]; ayuda?: string };

export type Pregunta = Base &
  (
    | { tipo: "texto" | "parrafo" | "email" | "telefono" | "enlace" | "fecha"; placeholder?: string }
    | { tipo: "numero" | "dinero"; placeholder?: string }
    | { tipo: "si_no" }
    | { tipo: "opcion"; opciones: Opcion[]; conOtro?: boolean }
    | { tipo: "opciones"; opciones: Opcion[]; conOtro?: boolean }
    /** Varias filas con los mismos campos (p. ej. un curso por fila). */
    | { tipo: "lista"; campos: CampoDeLista[]; textoAgregar: string; filasIniciales?: Record<string, string>[] }
  );

export type Seccion = {
  id: string;
  titulo: string;
  intro?: string;
  preguntas: Pregunta[];
  mostrarSi?: Condicion | Condicion[];
};

export type Cuestionario = {
  clave: string;
  titulo: string;
  bienvenida: string;
  secciones: Seccion[];
};

export type Valor = string | boolean | string[] | Record<string, string>[];
export type Respuestas = Record<string, Valor>;

function cumple(c: Condicion, respuestas: Respuestas): boolean {
  const v = respuestas[c.pregunta];
  if (c.incluye !== undefined) return Array.isArray(v) && (v as unknown[]).includes(c.incluye);
  if (c.igualA !== undefined) return v === c.igualA;
  if (c.distintoDe !== undefined) return v !== c.distintoDe;
  return v !== undefined && v !== "" && v !== false;
}

export function seMuestra(item: { mostrarSi?: Condicion | Condicion[] }, respuestas: Respuestas): boolean {
  if (!item.mostrarSi) return true;
  const condiciones = Array.isArray(item.mostrarSi) ? item.mostrarSi : [item.mostrarSi];
  return condiciones.every((c) => cumple(c, respuestas));
}

export function estaRespondida(p: Pregunta, v: Valor | undefined): boolean {
  if (v === undefined || v === null) return false;
  if (p.tipo === "si_no") return typeof v === "boolean";
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) {
    if (p.tipo === "lista") return (v as Record<string, string>[]).some((fila) => Object.values(fila).some((x) => x?.trim()));
    return v.length > 0;
  }
  return false;
}

/** Cuántas preguntas visibles hay y cuántas están respondidas, para la barra de avance. */
export function avance(c: Cuestionario, respuestas: Respuestas): { visibles: number; respondidas: number } {
  let visibles = 0;
  let respondidas = 0;
  for (const s of c.secciones) {
    if (!seMuestra(s, respuestas)) continue;
    for (const p of s.preguntas) {
      if (!seMuestra(p, respuestas)) continue;
      visibles += 1;
      if (estaRespondida(p, respuestas[p.id])) respondidas += 1;
    }
  }
  return { visibles, respondidas };
}

/** Las obligatorias visibles que faltan, por título. Vacío = se puede enviar. */
export function faltantes(c: Cuestionario, respuestas: Respuestas): string[] {
  const faltan: string[] = [];
  for (const s of c.secciones) {
    if (!seMuestra(s, respuestas)) continue;
    for (const p of s.preguntas) {
      if (p.obligatoria && seMuestra(p, respuestas) && !estaRespondida(p, respuestas[p.id])) {
        faltan.push(`${s.titulo}: ${p.titulo}`);
      }
    }
  }
  return faltan;
}

const MAX_TEXTO = 5000;
const MAX_FILAS = 40;

/**
 * Deja sólo lo que corresponde a preguntas del cuestionario, con el tipo correcto y recortado.
 * Lo que llega del navegador no se cree: una clave desconocida se descarta.
 */
export function limpiarRespuestas(c: Cuestionario, crudo: unknown): Respuestas {
  const entrada = crudo && typeof crudo === "object" && !Array.isArray(crudo) ? (crudo as Record<string, unknown>) : {};
  const salida: Respuestas = {};
  const texto = (x: unknown) => (typeof x === "string" ? x.slice(0, MAX_TEXTO) : null);
  for (const s of c.secciones) {
    for (const p of s.preguntas) {
      const v = entrada[p.id];
      if (v === undefined || v === null) continue;
      if (p.tipo === "si_no") {
        if (typeof v === "boolean") salida[p.id] = v;
      } else if (p.tipo === "opciones") {
        if (Array.isArray(v)) salida[p.id] = v.filter((x): x is string => typeof x === "string").slice(0, 50).map((x) => x.slice(0, 500));
      } else if (p.tipo === "lista") {
        if (Array.isArray(v)) {
          const ids = new Set(p.campos.map((f) => f.id));
          salida[p.id] = v.slice(0, MAX_FILAS).map((fila) => {
            const limpia: Record<string, string> = {};
            if (fila && typeof fila === "object") {
              for (const [k, x] of Object.entries(fila as Record<string, unknown>)) {
                const t = texto(x);
                if (ids.has(k) && t !== null) limpia[k] = t;
              }
            }
            return limpia;
          });
        }
      } else {
        const t = texto(v);
        if (t !== null) salida[p.id] = t;
      }
    }
    // Las respuestas "Otro: …" de opción y opciones.
    for (const p of s.preguntas) {
      if ((p.tipo === "opcion" || p.tipo === "opciones") && p.conOtro) {
        const t = texto(entrada[`${p.id}__otro`]);
        if (t !== null) salida[`${p.id}__otro`] = t;
      }
    }
  }
  return salida;
}

function etiquetaDe(opciones: Opcion[], valor: string): string {
  return opciones.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

/**
 * Las respuestas en texto (Markdown), sección por sección. Es lo que se le pasa a Claude para que
 * configure el espacio, y lo que se manda por correo al enviar. Incluye también las preguntas sin
 * responder, marcadas, para que se vea qué falta.
 */
export function respuestasEnTexto(c: Cuestionario, respuestas: Respuestas, destinatario: string): string {
  const lineas: string[] = [`# ${c.titulo} — ${destinatario}`, ""];
  for (const s of c.secciones) {
    if (!seMuestra(s, respuestas)) continue;
    lineas.push(`## ${s.titulo}`, "");
    for (const p of s.preguntas) {
      if (!seMuestra(p, respuestas)) continue;
      const v = respuestas[p.id];
      const otro = respuestas[`${p.id}__otro`];
      let r: string;
      if (!estaRespondida(p, v) && !(typeof otro === "string" && otro.trim())) {
        r = "_(sin responder)_";
      } else if (p.tipo === "si_no") {
        r = v ? "Sí" : "No";
      } else if (p.tipo === "opcion") {
        r = etiquetaDe(p.opciones, String(v ?? ""));
      } else if (p.tipo === "opciones") {
        r = ((v as string[] | undefined) ?? []).map((x) => etiquetaDe(p.opciones, x)).join("; ");
      } else if (p.tipo === "lista") {
        const filas = (v as Record<string, string>[]).filter((f) => Object.values(f).some((x) => x?.trim()));
        r =
          "\n" +
          filas
            .map((f, i) => {
              const partes = p.campos
                .map((campo) => {
                  const x = f[campo.id]?.trim();
                  if (!x) return null;
                  const valor = campo.tipo === "opcion" ? etiquetaDe(campo.opciones, x) : x;
                  return `${campo.titulo}: ${valor}`;
                })
                .filter(Boolean);
              return `  ${i + 1}. ${partes.join(" · ")}`;
            })
            .join("\n");
      } else {
        r = String(v);
      }
      if (typeof otro === "string" && otro.trim()) r = `${r === "_(sin responder)_" ? "" : `${r}; `}Otro: ${otro.trim()}`;
      lineas.push(`- **${p.titulo}** ${r}`);
    }
    lineas.push("");
  }
  return lineas.join("\n");
}
