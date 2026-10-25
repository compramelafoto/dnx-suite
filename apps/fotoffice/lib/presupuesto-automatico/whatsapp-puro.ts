/** Lo que el bot de WhatsApp le pasa a `preparar_presupuesto`, interpretado. Módulo PURO. */

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * La categoría que corresponde al tipo que dijo el cliente: igual al nombre (sin tildes ni
 * mayúsculas) o, si no, la única que lo contiene o está contenida. "XV" y "quince" se leen "15".
 */
export function categoriaDelTipo<T extends { id: string; name: string }>(categorias: readonly T[], tipo: string): T | null {
  const t = normalizar(tipo).replace(/\bquince\b/g, "15").replace(/\bxv\b/g, "15");
  if (!t) return null;
  const exacta = categorias.find((c) => normalizar(c.name) === t);
  if (exacta) return exacta;
  const parecidas = categorias.filter((c) => {
    const n = normalizar(c.name);
    return n.includes(t) || t.includes(n);
  });
  return parecidas.length === 1 ? parecidas[0] : null;
}

/** "aaaa-mm-dd" real → medianoche UTC (fecha de calendario, como guarda el formulario). Si no, null. */
export function fechaDelBot(v: string | null | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : d;
}
