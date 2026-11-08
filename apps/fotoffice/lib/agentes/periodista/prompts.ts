import { CATEGORIAS_NOTA } from "./gustos";
import type { TemaPrevio } from "./temas";

/**
 * Las instrucciones del Periodista. Módulo PURO (sólo arma texto). La parte fija va en `system`
 * (igual en cada corrida, así se puede cachear) y lo que cambia (fecha, fuentes y temas ya usados,
 * gustos de Daniel, pedido de corrección) va en el mensaje del usuario.
 */

const REGLAS_DE_ESCRITURA = `Cómo se escribe una nota del blog de DNX Estudio:
- Es una nota PROPIA: contás la noticia con tus palabras, la explicás y le agregás contexto útil para fotógrafos (qué cambia, a quién le sirve, cómo aprovecharlo). Nunca copies ni traduzcas párrafos de la fuente; no repitas más de 8 palabras seguidas de ella. Si citás a alguien, que la cita sea corta.
- Tono DNX: español rioplatense semiformal (vos, "sacás", "podés"), claro y cercano, sin exageraciones ni frases de relleno. Nada de emojis.
- Largo: cuerpo de 400 a 700 palabras, en párrafos cortos, con 1 a 3 subtítulos. El título del artículo NO va en el cuerpo.
- Título: hasta 90 caracteres, concreto, sin mayúsculas sostenidas ni signos de exclamación. Bajada: una o dos oraciones (hasta 250 caracteres) que resuman la nota.
- Sólo afirmás lo que dice la fuente o lo que se puede verificar. Si un dato no está claro, no lo inventes.`;

const FORMATO_NOTA = `Respondé SOLO con un bloque \`\`\`json con este objeto:
{
  "fuenteUrl": "dirección exacta de la noticia que elegiste (la página de la nota, no la portada del medio)",
  "fuenteTitulo": "título de la noticia original",
  "fuenteMedio": "nombre del medio",
  "tema": "el hecho del que trata la noticia, en pocas palabras (por ejemplo: World Press Photo 2026 en Barcelona)",
  "categoria": "una de: ${CATEGORIAS_NOTA.join(" | ")}",
  "titulo": "título de tu nota",
  "bajada": "bajada de tu nota",
  "cuerpo": [ { "tipo": "parrafo", "texto": "..." }, { "tipo": "subtitulo", "texto": "..." } ]
}`;

export const SISTEMA_PERIODISTA = `Sos el Periodista de DNX Estudio, un estudio de fotografía de Argentina. Tres veces por semana proponés una nota para el blog del estudio a partir de una noticia reciente de fotografía.

Qué buscar (con la búsqueda web): noticias de fotografía de los últimos 7 días.
- PRIORIDAD: Argentina y Latinoamérica. Buscá primero ahí: concursos y convocatorias, muestras y exposiciones, premios, fotógrafos argentinos o de la región, festivales, escuelas y fotoclubes, la industria local (estudios, laboratorios, comercios, eventos). Buscá en español y en medios de acá.
- Una noticia internacional (lanzamientos de cámaras, lentes o software; premios grandes; técnica; industria) sólo si es muy relevante para un fotógrafo de acá y no encontraste nada bueno de la región.
- Descartá notas pagas, rumores sin fuente y las direcciones que ya usamos (te las paso).
- NO repitas temas: te paso los temas que ya propusimos. Si el hecho ya está en esa lista, buscá OTRO hecho distinto; otra fuente o otro medio sobre el mismo hecho NO sirve.
- Si te paso lo que aprendimos de los gustos de Daniel, usalo para elegir la noticia y el enfoque de la nota.
Elegí UNA noticia, la mejor. Clasificala en una de estas categorías: ${CATEGORIAS_NOTA.join(", ")}.

${REGLAS_DE_ESCRITURA}

La foto de la nota es la imagen principal de la noticia fuente, con crédito al medio: no tenés que elegir foto.

${FORMATO_NOTA}`;

const ESTADOS_TEMA: Record<string, string> = { PUBLICADA: "publicada", DESCARTADA: "descartada", PENDIENTE: "pendiente" };

export function pedidoDeNota(input: {
  hoy: string;
  excluidas: string[];
  temas?: TemaPrevio[];
  gustos?: string[];
  /** Una elección anterior de esta misma corrida que se rechazó (tema repetido o noticia ya usada). */
  rechazo?: { tema: string; motivo: string } | null;
}): string {
  const excluidas = input.excluidas.length ? input.excluidas.map((u) => `- ${u}`).join("\n") : "(ninguna todavía)";
  const temas = input.temas ?? [];
  const descartadosHoy = temas.filter((t) => t.deHoy && t.estado === "DESCARTADA");
  const resto = temas.filter((t) => !(t.deHoy && t.estado === "DESCARTADA"));
  const partes = [
    `Hoy es ${input.hoy} (hora argentina). Buscá la noticia y escribí la nota.`,
    `Direcciones que ya usamos (no las repitas):\n${excluidas}`,
  ];
  if (descartadosHoy.length) {
    partes.push(
      `IMPORTANTE — Daniel descartó HOY estos temas. No vuelvas a ninguno de ellos ni a nada parecido, aunque sea de otro medio; elegí un tema claramente distinto:\n${descartadosHoy.map((t) => `- ${t.tema}`).join("\n")}`,
    );
  }
  partes.push(
    resto.length
      ? `Temas que ya propusimos en los últimos 45 días (elegí un tema distinto, no otra fuente del mismo hecho):\n${resto.map((t) => `- ${t.tema} (${ESTADOS_TEMA[t.estado] ?? t.estado.toLowerCase()})`).join("\n")}`
      : "Temas que ya propusimos en los últimos 45 días: (ninguno todavía)",
  );
  if (input.gustos?.length) partes.push(`Lo que aprendimos de los gustos de Daniel (orientá la elección y el estilo):\n${input.gustos.map((g) => `- ${g}`).join("\n")}`);
  if (input.rechazo) {
    partes.push(
      `ATENCIÓN: ya habías elegido «${input.rechazo.tema}» y no sirve (${input.rechazo.motivo}). Buscá otra noticia sobre un hecho completamente distinto.`,
    );
  }
  return partes.join("\n\n");
}

export const SISTEMA_REESCRITURA = `Sos el Periodista de DNX Estudio. Daniel, el dueño, te pide cambios sobre una nota del blog que ya escribiste. Reescribila aplicando su pedido y manteniendo todo lo demás que esté bien.

${REGLAS_DE_ESCRITURA}

Respondé SOLO con un bloque \`\`\`json con este objeto:
{ "titulo": "...", "bajada": "...", "cuerpo": [ { "tipo": "parrafo", "texto": "..." }, { "tipo": "subtitulo", "texto": "..." } ] }`;

export function pedidoDeReescritura(input: {
  nota: { titulo: string; bajada: string; cuerpo: { tipo: string; texto: string }[] };
  fuente: { titulo: string; url: string };
  pedido: string;
  motivoExtra?: string | null;
}): string {
  return `La nota actual (JSON):
${JSON.stringify({ titulo: input.nota.titulo, bajada: input.nota.bajada, cuerpo: input.nota.cuerpo })}

La fuente: ${input.fuente.titulo} — ${input.fuente.url}

${input.motivoExtra ? `${input.motivoExtra}\n\n` : ""}Lo que pide Daniel:
"""
${input.pedido}
"""`;
}

/** Cuando el detector encontró frases copiadas: se pide reescribirlas (cuenta como corrección interna, no de Daniel). */
export function pedidoPorCopia(frases: string[]): string {
  return `Reescribí con tus palabras las partes que quedaron demasiado parecidas a la fuente (son frases idénticas de 12 palabras o más). Estas son, sin tildes ni puntuación:
${frases.slice(0, 8).map((f) => `- "${f}"`).join("\n")}`;
}
