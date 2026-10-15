/** Query string que se conserva al pasar del tablero a la lista: todo menos `vista`. */
export function reenviarALista(sp: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "vista" || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) q.append(k, x);
  }
  const s = q.toString();
  return s ? `/proyectos/lista?${s}` : "/proyectos/lista";
}
