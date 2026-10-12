// Lógica pura (sin React) de la burbuja: convierte eventos SSE en la lista de mensajes.
export type Item =
  | { kind: "user"; text: string }
  | { kind: "bot"; text: string }
  | { kind: "proposal"; actionId: string; summary: string; state: "pending" | "done" | "rejected" | "failed"; result?: string; canUndo?: boolean }
  | { kind: "notice"; text: string; offerTicket?: boolean };

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
  if (event === "error") {
    return [...items, { kind: "notice", text: String(d.message), offerTicket: Boolean(d.offerTicket) }];
  }
  return items;
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
