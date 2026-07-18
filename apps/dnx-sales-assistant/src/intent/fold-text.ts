/** Minúsculas + sin diacríticos para matching de reglas. */
export function foldTextForIntent(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}
