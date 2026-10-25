/**
 * Base en memoria SÓLO PARA PRUEBAS de `lib/alboom`: las dos tablas de la etapa 8A y `WorkspaceIntegration`, con
 * los filtros que usa el código (igualdad, `in`, `notIn`, `gt`, `lt`, `null`, `OR`), `select`, `orderBy`, `take`,
 * el único (workspaceId, entity, alboomId) y el índice único parcial de "una extracción activa por workspace".
 * Así las pruebas miran el resultado y no la forma de las llamadas.
 */

type Fila = Record<string, unknown>;
type Where = Record<string, unknown>;

function igual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function comparar(a: unknown, b: unknown): number {
  const x = a instanceof Date ? a.getTime() : (a as number | string);
  const y = b instanceof Date ? b.getTime() : (b as number | string);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function cumple(fila: Fila, where: Where = {}): boolean {
  for (const [k, cond] of Object.entries(where)) {
    if (k === "OR") {
      if (!(cond as Where[]).some((w) => cumple(fila, w))) return false;
      continue;
    }
    const v = fila[k];
    if (cond === null) {
      if (v !== null && v !== undefined) return false;
      continue;
    }
    if (typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>;
      if ("in" in c && !(c.in as unknown[]).some((x) => igual(x, v))) return false;
      if ("notIn" in c && (c.notIn as unknown[]).some((x) => igual(x, v))) return false;
      if ("gt" in c && (v === null || v === undefined || comparar(v, c.gt) <= 0)) return false;
      if ("lt" in c && (v === null || v === undefined || comparar(v, c.lt) >= 0)) return false;
      continue;
    }
    if (!igual(v, cond)) return false;
  }
  return true;
}

function elegir(fila: Fila, select?: Record<string, boolean>): Fila {
  if (!select) return { ...fila };
  return Object.fromEntries(Object.keys(select).map((k) => [k, fila[k]]));
}

function ordenar(filas: Fila[], orderBy?: Record<string, "asc" | "desc">): Fila[] {
  if (!orderBy) return filas;
  const [[campo, dir]] = Object.entries(orderBy) as [[string, "asc" | "desc"]];
  return [...filas].sort((a, b) => comparar(a[campo], b[campo]) * (dir === "asc" ? 1 : -1));
}

let secuencia = 0;
const nuevoId = () => `id${++secuencia}`;

export function crearBaseAlboom() {
  const datos = { crudos: [] as Fila[], extracciones: [] as Fila[], integraciones: [] as Fila[], cargas: [] as Fila[] };

  const consulta = (tabla: () => Fila[]) => ({
    findMany: async (a: { where?: Where; select?: Record<string, boolean>; orderBy?: Record<string, "asc" | "desc">; take?: number } = {}) =>
      ordenar(tabla().filter((f) => cumple(f, a.where)), a.orderBy)
        .slice(0, a.take ?? Infinity)
        .map((f) => elegir(f, a.select)),
    findFirst: async (a: { where?: Where; select?: Record<string, boolean>; orderBy?: Record<string, "asc" | "desc"> } = {}) => {
      const f = ordenar(tabla().filter((x) => cumple(x, a.where)), a.orderBy)[0];
      return f ? elegir(f, a.select) : null;
    },
    updateMany: async (a: { where: Where; data: Fila }) => {
      const filas = tabla().filter((f) => cumple(f, a.where));
      for (const f of filas) Object.assign(f, a.data, "updatedAt" in f ? { updatedAt: new Date() } : {});
      return { count: filas.length };
    },
    count: async (a: { where?: Where } = {}) => tabla().filter((f) => cumple(f, a.where)).length,
  });

  const prisma = {
    fotofficeAlboomCrudo: {
      ...consulta(() => datos.crudos),
      createMany: async (a: { data: Fila[]; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const d of a.data) {
          const repetida = datos.crudos.some((f) => f.workspaceId === d.workspaceId && f.entity === d.entity && f.alboomId === d.alboomId);
          if (repetida) {
            if (a.skipDuplicates) continue;
            throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
          }
          datos.crudos.push({ id: nuevoId(), fetchedAt: new Date(), firstSeenAt: new Date(), ...d });
          count++;
        }
        return { count };
      },
      deleteMany: async (a: { where: Where }) => {
        const antes = datos.crudos.length;
        datos.crudos = datos.crudos.filter((f) => !cumple(f, a.where));
        return { count: antes - datos.crudos.length };
      },
    },
    fotofficeAlboomExtraccion: {
      ...consulta(() => datos.extracciones),
      create: async (a: { data: Fila; select?: Record<string, boolean> }) => {
        const activa = (s: unknown) => s === "PENDIENTE" || s === "CORRIENDO";
        const status = a.data.status ?? "PENDIENTE";
        if (activa(status) && datos.extracciones.some((f) => f.workspaceId === a.data.workspaceId && activa(f.status))) {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        const fila: Fila = {
          id: nuevoId(),
          status,
          mode: "TODO",
          progress: {},
          startedByUserId: null,
          startedAt: new Date(Date.now() + secuencia),
          finishedAt: null,
          errorReason: null,
          lockedUntil: null,
          updatedAt: new Date(),
          ...a.data,
        };
        datos.extracciones.push(fila);
        return elegir(fila, a.select);
      },
      deleteMany: async (a: { where: Where }) => {
        const antes = datos.extracciones.length;
        datos.extracciones = datos.extracciones.filter((f) => !cumple(f, a.where));
        return { count: antes - datos.extracciones.length };
      },
    },
    /** Etapa 8B-1: sólo para que la extracción vea si hay una carga activa. */
    fotofficeAlboomCarga: consulta(() => datos.cargas),
    workspaceIntegration: {
      upsert: async ({ create }: { create: Fila }) => {
        datos.integraciones = datos.integraciones.filter((r) => r.workspaceId !== create.workspaceId || r.integrationKey !== create.integrationKey);
        const fila = { ...create, connectedAt: new Date(), lastUsedAt: null };
        datos.integraciones.push(fila);
        return fila;
      },
      findUnique: async ({ where, select }: { where: { workspaceId_integrationKey: Fila }; select?: Record<string, boolean> }) => {
        const f = datos.integraciones.find((r) => cumple(r, where.workspaceId_integrationKey));
        return f ? elegir(f, select) : null;
      },
      update: async ({ where, data }: { where: { workspaceId_integrationKey: Fila }; data: Fila }) => {
        const f = datos.integraciones.find((r) => cumple(r, where.workspaceId_integrationKey));
        if (!f) throw new Error("Record to update not found.");
        Object.assign(f, data);
        return f;
      },
      delete: async ({ where }: { where: { workspaceId_integrationKey: Fila } }) => {
        datos.integraciones = datos.integraciones.filter((r) => !cumple(r, where.workspaceId_integrationKey));
        return null;
      },
    },
  };

  return {
    prisma,
    datos,
    vaciar() {
      datos.crudos = [];
      datos.extracciones = [];
      datos.integraciones = [];
      datos.cargas = [];
    },
  };
}
