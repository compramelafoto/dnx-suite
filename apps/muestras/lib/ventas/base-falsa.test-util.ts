/**
 * Una base en memoria para los tests de la conciliación y el barrido: tablas como listas y un
 * `where` simple (igualdad, `in`, `notIn`, `not`, `lt`, `lte`, `gte`, `OR`). No es Prisma: alcanza
 * para ver qué filas cambian y cuántas veces.
 */
type Fila = Record<string, unknown>;
type Where = Record<string, unknown>;

function valorCoincide(v: unknown, cond: unknown): boolean {
  if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
    const c = cond as Record<string, unknown>;
    if ("in" in c && !(c.in as unknown[]).includes(v)) return false;
    if ("notIn" in c && (c.notIn as unknown[]).includes(v)) return false;
    if ("not" in c && (c.not === null ? v == null : v === c.not)) return false;
    const n = v instanceof Date ? v.getTime() : (v as number);
    const t = (x: unknown) => (x instanceof Date ? x.getTime() : (x as number));
    if ("lt" in c && !(v != null && n < t(c.lt))) return false;
    if ("lte" in c && !(v != null && n <= t(c.lte))) return false;
    if ("gte" in c && !(v != null && n >= t(c.gte))) return false;
    return true;
  }
  if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
  return (v ?? null) === cond;
}

export function coincide(f: Fila, w: Where | undefined): boolean {
  if (!w) return true;
  return Object.entries(w).every(([k, cond]) => {
    if (k === "OR") return (cond as Where[]).some((x) => coincide(f, x));
    return valorCoincide(f[k], cond);
  });
}

const copia = (f: Fila | undefined): Fila | null => (f ? { ...f } : null);

export function tablaFalsa(filas: Fila[], prefijo: string) {
  let n = 0;
  return {
    filas,
    // Como Prisma, las lecturas devuelven copias: cambiar la tabla después no cambia lo leído.
    findUnique: async (q: { where: Where }) => copia(filas.find((f) => coincide(f, q.where))),
    findFirst: async (q: { where?: Where }) => copia(filas.find((f) => coincide(f, q.where))),
    findMany: async (q: { where?: Where; take?: number } = {}) => filas.filter((f) => coincide(f, q.where)).slice(0, q.take ?? Infinity).map((f) => ({ ...f })),
    count: async (q: { where?: Where } = {}) => filas.filter((f) => coincide(f, q.where)).length,
    create: async (q: { data: Fila }) => {
      const f = { id: `${prefijo}${++n}`, createdAt: new Date(), ...q.data };
      filas.push(f);
      return { ...f };
    },
    update: async (q: { where: Where; data: Fila }) => {
      const f = filas.find((x) => coincide(x, q.where));
      if (!f) throw new Error("no existe");
      Object.assign(f, q.data);
      return f;
    },
    updateMany: async (q: { where: Where; data: Fila }) => {
      const hits = filas.filter((f) => coincide(f, q.where));
      for (const f of hits) Object.assign(f, q.data);
      return { count: hits.length };
    },
  };
}
