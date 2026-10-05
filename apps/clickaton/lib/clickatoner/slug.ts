/**
 * La dirección pública de un clickatoner: `/clickatoners/maria-gomez`. Módulo puro.
 *
 * Sale del nombre, sin tildes ni signos. Si ya está tomada, se le suma un número: "maria-gomez-2".
 */
export function baseSlug(firstName: string, lastName: string): string {
  const s = `${firstName} ${lastName}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "clickatoner";
}

export function freeSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i += 1) {
    const candidato = `${base}-${i}`;
    if (!taken.has(candidato)) return candidato;
  }
}

/** Normaliza el email que identifica a la persona. */
export function personKey(email: string): string {
  return email.trim().toLowerCase();
}
