// Lógica pura (sin React) de la burbuja: convierte eventos SSE en la lista de mensajes.
import { parseProgreso, type ProgresoEscolar } from "./globito";

export type Item =
  | { kind: "user"; text: string }
  | { kind: "bot"; text: string }
  | { kind: "proposal"; actionId: string; summary: string; state: "pending" | "done" | "rejected" | "failed"; result?: string; canUndo?: boolean }
  | { kind: "notice"; text: string; offerTicket?: boolean }
  | { kind: "progreso"; progreso: ProgresoEscolar };

/** Pone la tarjeta de progreso al final y saca la anterior: siempre queda una sola, la más nueva. */
export function withProgreso(items: Item[], progreso: ProgresoEscolar): Item[] {
  return [...items.filter((it) => it.kind !== "progreso"), { kind: "progreso", progreso }];
}

export function applySseEvent(items: Item[], event: string, d: Record<string, unknown>): Item[] {
  if (event === "text") {
    const delta = String(d.delta ?? "");
    const copy = [...items];
    for (let i = copy.length - 1; i >= 0; i--) {
      const it = copy[i]!;
      if (it.kind === "bot") {
        copy[i] = { kind: "bot", text: it.text + delta };
        return copy;
      }
    }
    return [...copy, { kind: "bot", text: delta }];
  }
  if (event === "proposal") {
    return [...items, { kind: "proposal", actionId: String(d.actionId), summary: String(d.summary), state: "pending" }, { kind: "bot", text: "" }];
  }
  if (event === "progreso") {
    const p = parseProgreso(d);
    // Como la propuesta: la tarjeta y después un bot vacío para que el texto siga debajo.
    return p ? [...withProgreso(items, p), { kind: "bot", text: "" }] : items;
  }
  if (event === "error") {
    return [...items, { kind: "notice", text: String(d.message), offerTicket: Boolean(d.offerTicket) }];
  }
  return items;
}

/**
 * Al mandar el primer mensaje, lo que se veía como saludo (el texto del globito del mail y la tarjeta de progreso)
 * pasa a ser parte de la conversación para que no desaparezca de la pantalla.
 */
export function seedIntro(items: Item[], intro: { texto?: string | null; progreso?: ProgresoEscolar | null }): Item[] {
  if (items.length > 0) return items;
  const out: Item[] = [];
  if (intro.texto) out.push({ kind: "bot", text: intro.texto });
  if (intro.progreso) out.push({ kind: "progreso", progreso: intro.progreso });
  return out;
}

export function dropEmptyBot(items: Item[]): Item[] {
  return items.filter((it) => !(it.kind === "bot" && it.text === ""));
}

export function applyDecision(
  items: Item[],
  actionId: string,
  decision: "confirmar" | "rechazar" | "deshacer",
  r: { ok: boolean; message: string; canUndo?: boolean },
): Item[] {
  return items.map((it) => {
    if (it.kind !== "proposal" || it.actionId !== actionId) return it;
    // Resultado tardío o repetido: confirmar/rechazar solo valen sobre "pending"; deshacer solo sobre "done".
    if (decision === "deshacer" ? it.state !== "done" : it.state !== "pending") return it;
    // Deshacer nunca cambia el estado: el cambio se hizo. Si falla, se muestra el motivo y el botón
    // sólo sigue si el servidor dice que se puede reintentar (un 409 trae canUndo ausente/false).
    if (decision === "deshacer") return { ...it, result: r.message, canUndo: !r.ok && r.canUndo === true };
    return { ...it, state: decision === "rechazar" ? "rejected" : r.ok ? "done" : "failed", result: r.message, canUndo: decision === "confirmar" && r.canUndo };
  });
}
