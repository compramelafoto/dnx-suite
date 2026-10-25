/**
 * Ventana del historial que se manda al modelo. La conversación se guarda ENTERA y nunca se corta
 * en silencio (antes, pasado un tope de filas, se abría otra conversación y el bot se olvidaba de
 * todo: FOTOFFICE, 13/10). Lo que se acota es lo que viaja en cada turno:
 *
 * - Sólo los últimos turnos. Un turno empieza en un mensaje de la persona (texto, no tool_result),
 *   así el recorte nunca separa un tool_use de su tool_result.
 * - Los turnos viejos se descartan DE A BLOQUES (`step`): el prefijo enviado queda igual durante
 *   varios turnos y el caché automático del historial sigue sirviendo. Se rompe una vez por bloque.
 * - Lo descartado se resume en el servidor (determinístico: mismo historial, mismo texto) para ir
 *   en la situación del turno.
 */

export type HistoryWindowOptions = {
  /** Turnos (de la persona) que entran como máximo. */
  maxTurns?: number;
  /** De a cuántos turnos se descartan los viejos (estabilidad del caché). */
  step?: number;
  /** Tope de tamaño (JSON) de lo enviado: con historiales muy pesados se descartan más bloques. */
  maxChars?: number;
  /** Turnos que quedan siempre, aunque pese más que `maxChars`. */
  minTurns?: number;
};

export const DEFAULT_HISTORY_WINDOW: Required<HistoryWindowOptions> = {
  maxTurns: 40,
  step: 20,
  maxChars: 160_000,
  minTurns: 4,
};

/**
 * Tope duro por conversación, en turnos de la persona (no en filas). Sólo para no cargar historiales
 * eternos de la base: el costo por turno ya lo acota la ventana. Al pasarlo se abre otra
 * conversación que arranca con `carryOverMessage` (el usuario no ve corte).
 */
export const HARD_CAP_TURNS = 200;

export type HistoryWindow = {
  /** Lo que se manda al modelo. */
  messages: unknown[];
  /** Índice (en el historial completo) del primer mensaje enviado. */
  start: number;
  droppedTurns: number;
  totalTurns: number;
  /** Resumen de lo descartado, para la situación. null si no se descartó nada. */
  summary: string | null;
};

type Block = { type?: unknown; text?: unknown; name?: unknown };

function blocks(content: unknown): Block[] {
  return Array.isArray(content) ? (content.filter((b) => b && typeof b === "object") as Block[]) : [];
}

/** Mensaje de la persona (o aviso [Sistema]) que abre un turno: rol user y sin tool_result. */
export function isTurnStart(m: unknown): boolean {
  if (!m || typeof m !== "object") return false;
  const { role, content } = m as { role?: unknown; content?: unknown };
  if (role !== "user") return false;
  if (typeof content === "string") return true;
  return Array.isArray(content) && !blocks(content).some((b) => b.type === "tool_result");
}

export function countTurns(history: unknown[]): number {
  return history.reduce<number>((n, m) => n + (isTurnStart(m) ? 1 : 0), 0);
}

function size(msgs: unknown[]): number {
  return JSON.stringify(msgs).length;
}

export function windowHistory(history: unknown[], options: HistoryWindowOptions = {}): HistoryWindow {
  const o = { ...DEFAULT_HISTORY_WINDOW, ...options };
  const starts: number[] = [];
  history.forEach((m, i) => {
    if (isTurnStart(m)) starts.push(i);
  });
  const total = starts.length;
  const keepAtLeast = Math.max(1, Math.min(o.minTurns, total));
  let drop = 0;
  if (total > o.maxTurns) drop = Math.ceil((total - o.maxTurns) / o.step) * o.step;
  drop = Math.min(drop, total - keepAtLeast);
  while (drop < total - keepAtLeast && size(history.slice(starts[drop]!)) > o.maxChars) {
    drop = Math.min(drop + o.step, total - keepAtLeast);
  }
  if (total === 0 || drop <= 0) return { messages: history, start: 0, droppedTurns: 0, totalTurns: total, summary: null };
  const start = starts[drop]!;
  return {
    messages: history.slice(start),
    start,
    droppedTurns: drop,
    totalTurns: total,
    summary: summarizeDropped(history.slice(0, start)),
  };
}

function textOf(m: unknown): string {
  const content = (m as { content?: unknown }).content;
  if (typeof content === "string") return content;
  return blocks(content)
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join(" ");
}

function cut(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export type SummaryOptions = { maxTexts?: number; maxCharsPerText?: number };

/**
 * Resumen de los mensajes que quedaron afuera: lo que escribió la persona (los últimos, recortados)
 * y las herramientas que ya se usaron. No incluye respuestas del bot: las cifras salen de las
 * herramientas o de la persona, nunca de un resumen.
 */
export function summarizeDropped(dropped: unknown[], options: SummaryOptions = {}): string | null {
  const maxTexts = options.maxTexts ?? 15;
  const maxChars = options.maxCharsPerText ?? 240;
  const texts = dropped.filter(isTurnStart).map(textOf).filter((t) => t.trim().length > 0);
  if (texts.length === 0) return null;
  const tools = new Map<string, number>();
  for (const m of dropped) {
    if ((m as { role?: unknown }).role !== "assistant") continue;
    for (const b of blocks((m as { content?: unknown }).content)) {
      if (b.type === "tool_use" && typeof b.name === "string") tools.set(b.name, (tools.get(b.name) ?? 0) + 1);
    }
  }
  const shown = texts.slice(-maxTexts);
  const older = texts.length - shown.length;
  const lines = [
    "# Antes en esta conversación",
    `Esta conversación sigue (no la empezaste de nuevo): ${texts.length} mensajes anteriores quedaron fuera de lo que ves. Lo que escribió la persona, del más viejo al más nuevo (recortado)${older > 0 ? `; hay ${older} más viejos que no se muestran` : ""}:`,
    ...shown.map((t) => `- «${cut(t, maxChars)}»`),
  ];
  if (tools.size > 0) lines.push(`Herramientas que ya usaste: ${[...tools.keys()].sort().join(", ")}.`);
  lines.push("No vuelvas a preguntar lo que ya respondió. Si necesitás un dato de antes, buscalo con tus herramientas o pedí sólo ese.");
  return lines.join("\n");
}

/** Primer mensaje de la conversación que sigue a una que pasó el tope duro: el resumen de la anterior. */
export function carryOverMessage(previous: unknown[]): { role: "user"; content: string } {
  const s = summarizeDropped(previous) ?? "(sin mensajes)";
  return {
    role: "user",
    content: `[Sistema] Esta conversación continúa otra que se hizo muy larga; la persona no empezó de nuevo.\n${s}`,
  };
}
