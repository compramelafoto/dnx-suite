/**
 * Opiniones escritas de la comisión sobre un proyecto. Módulo PURO.
 *
 * El voto dice sí o no; la opinión dice por qué, o con qué condición ("a favor si baja el
 * costo"). Se escriben antes de la reunión y se leen mientras se trata el tema. Son internas de
 * la comisión, como el voto nominal. Nada se borra: quien la escribió la puede retirar.
 */

export const MAX_COMMENT = 2_000;

export function parseCommentBody(raw: unknown): { ok: true; body: string } | { ok: false; error: string } {
  const body = String(raw ?? "").trim();
  if (body === "") return { ok: false, error: "Escribí tu opinión." };
  if (body.length > MAX_COMMENT) return { ok: false, error: `La opinión puede tener hasta ${MAX_COMMENT} caracteres.` };
  return { ok: true, body };
}

export function canWithdrawComment(comment: { authorUserId: number; withdrawnAt: Date | null }, userId: number): boolean {
  return comment.withdrawnAt === null && comment.authorUserId === userId;
}

/** "3 opiniones" para el temario. Las retiradas no cuentan. */
export function commentCountLabel(n: number): string {
  if (n === 0) return "Sin opiniones";
  return n === 1 ? "1 opinión" : `${n} opiniones`;
}
