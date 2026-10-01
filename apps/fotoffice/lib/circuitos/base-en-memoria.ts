/**
 * Base en memoria SÓLO PARA PRUEBAS del motor de etapas. Aplica de verdad los filtros que usa
 * el motor (igualdad —fechas por valor—, `in`, relaciones `circuit`/`stage`/`journey`),
 * `select`, `orderBy`, el índice único parcial de recorridos abiertos y deshace todo lo escrito
 * cuando la transacción lanza. Así las pruebas miran el resultado, no la forma de las llamadas.
 *
 * Como Prisma, `$transaction(fn)` le pasa a `fn` un cliente `tx` propio. Mientras la transacción
 * está abierta, usar el `prisma` global lanza (en la base real esa escritura quedaría afuera de
 * la transacción y no se desharía), y usar `tx` después de cerrada también lanza.
 * Para simular fallas o carreras, las pruebas reemplazan métodos en `tablas` (lo usan ambos).
 */

type Fila = Record<string, unknown>;
type Where = Record<string, unknown>;
type Orden = Record<string, "asc" | "desc">;

const TABLAS = [
  "fotofficeCircuit", "fotofficeStage", "fotofficeStageTaskTemplate", "fotofficeLossReason",
  "fotofficeJourney", "fotofficeJourneyStep", "fotofficeTask", "serviceSalesLead", "workspaceMembership",
  "fotofficeStageRule", "fotofficeProcessedEvent", "fotofficeWorkspaceBranding", "serviceLeadForm",
  // Campos personalizados (0.5) y los registros a los que se cuelgan.
  "fotofficeCustomField", "fotofficeCustomFieldOption", "fotofficeCustomValue", "fotofficeCustomValueChange",
  "client", "member",
  // Numeración (0.5).
  "fotofficeSequence", "fotofficeSequenceChange", "fotofficeRecordNumber",
] as const;
export type Tabla = (typeof TABLAS)[number];

/** Relación → (columna con el id, tabla de destino). */
const RELACIONES: Record<string, { columna: string; tabla: Tabla }> = {
  circuit: { columna: "circuitId", tabla: "fotofficeCircuit" },
  stage: { columna: "stageId", tabla: "fotofficeStage" },
  journey: { columna: "journeyId", tabla: "fotofficeJourney" },
  field: { columna: "fieldId", tabla: "fotofficeCustomField" },
};

const DEFECTOS: Partial<Record<Tabla, () => Fila>> = {
  fotofficeCircuit: () => ({ isActive: true, isDefault: false, createdAt: new Date() }),
  fotofficeStage: () => ({ color: "gris", days: 0, requireTasks: false, leadStatus: null, archivedAt: null }),
  fotofficeStageTaskTemplate: () => ({ days: 0, required: false }),
  fotofficeLossReason: () => ({ order: 0, isActive: true }),
  fotofficeJourney: () => ({
    stageId: null, outcome: null, lossReasonId: null, enteredStageAt: new Date(), stageDueAt: null,
    ownerUserId: null, closedAt: null, createdAt: new Date(),
  }),
  fotofficeJourneyStep: () => ({
    fromStageId: null, toStageId: null, outcome: null, note: null, auto: false, event: null,
    forcedWithPendingTasks: false, actorUserId: null, createdAt: new Date(),
  }),
  fotofficeTask: () => ({
    journeyId: null, stageId: null, dueAt: null, assigneeUserId: null, required: false, doneAt: null,
    doneByUserId: null, createdByUserId: null, createdAt: new Date(),
  }),
  serviceSalesLead: () => ({ status: "NEW", eventDate: null, createdAt: new Date(), updatedAt: new Date() }),
  fotofficeCustomField: () => ({ required: false, showInList: false, order: 0, archivedAt: null, createdAt: new Date() }),
  fotofficeCustomFieldOption: () => ({ order: 0, archivedAt: null }),
  fotofficeCustomValue: () => ({
    valueText: null, valueNumber: null, valueDate: null, valueBool: null, optionId: null, updatedAt: new Date(),
    updatedByUserId: null,
  }),
  fotofficeCustomValueChange: () => ({ before: null, after: null, actorUserId: null, actorLabel: null, createdAt: new Date() }),
  fotofficeSequence: () => ({ prefix: "", withYear: false, digits: 1, nextValue: 1, currentYear: null }),
  fotofficeSequenceChange: () => ({ before: null, after: null, actorUserId: null, actorLabel: null, createdAt: new Date() }),
  fotofficeRecordNumber: () => ({ year: null, createdAt: new Date() }),
};

function igual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function clonar(v: unknown): unknown {
  if (v instanceof Date) return new Date(v.getTime());
  if (Array.isArray(v)) return v.map(clonar);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clonar(x)]));
  return v;
}

export function crearBaseEnMemoria() {
  const datos = Object.fromEntries(TABLAS.map((t) => [t, [] as Fila[]])) as Record<Tabla, Fila[]>;
  let secuencia = 0;
  const transacciones: { opciones: unknown }[] = [];

  function cumple(f: Fila, where: Where | undefined): boolean {
    if (!where) return true;
    return Object.entries(where).every(([k, cond]) => {
      if (cond === undefined) return true;
      if (k === "OR") return (cond as Where[]).some((w) => cumple(f, w));
      if (k === "AND") return (cond as Where[]).every((w) => cumple(f, w));
      const rel = RELACIONES[k];
      if (rel && cond && typeof cond === "object") {
        const destino = datos[rel.tabla].find((x) => x.id === f[rel.columna]);
        return destino !== undefined && cumple(destino, cond as Where);
      }
      if (cond && typeof cond === "object" && !(cond instanceof Date)) {
        const c = cond as Record<string, unknown>;
        const v = f[k] ?? null;
        const n = (x: unknown) => (x instanceof Date ? x.getTime() : (x as number | string));
        return Object.entries(c).every(([op, x]) => {
          if (x === undefined) return true;
          if (op === "in") return (x as unknown[]).some((y) => igual(v, y));
          if (op === "not") return !igual(v, x);
          if (v === null) return false;
          if (op === "lt") return n(v) < n(x);
          if (op === "lte") return n(v) <= n(x);
          if (op === "gt") return n(v) > n(x);
          if (op === "gte") return n(v) >= n(x);
          throw new Error(`Filtro no soportado en ${k}: ${op}`);
        });
      }
      return igual(f[k] ?? null, cond);
    });
  }

  function elegir(f: Fila, select?: Record<string, boolean>): Fila {
    const copia = clonar(f) as Fila;
    if (!select) return copia;
    return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, copia[k]]));
  }

  function ordenar(filas: Fila[], orderBy?: Orden | Orden[]): Fila[] {
    if (!orderBy) return filas;
    const claves = (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap((o) => Object.entries(o));
    return [...filas].sort((a, b) => {
      for (const [k, dir] of claves) {
        const va = a[k] instanceof Date ? (a[k] as Date).getTime() : (a[k] as number | string);
        const vb = b[k] instanceof Date ? (b[k] as Date).getTime() : (b[k] as number | string);
        if (va < vb) return dir === "asc" ? -1 : 1;
        if (va > vb) return dir === "asc" ? 1 : -1;
      }
      return 0;
    });
  }

  /** Índices únicos que el motor usa para detectar carreras y repeticiones. */
  type Unico = { columnas: string[]; aplica?: (f: Fila) => boolean };
  const UNICOS: Partial<Record<Tabla, Unico[]>> = {
    fotofficeJourney: [{ columnas: ["workspaceId", "subjectType", "subjectId", "kind"], aplica: (f) => f.closedAt === null }],
    fotofficeProcessedEvent: [{ columnas: ["journeyId", "event", "sourceRef"] }],
    fotofficeCustomField: [{ columnas: ["workspaceId", "entityType", "key"] }],
    fotofficeCustomValue: [{ columnas: ["fieldId", "entityId"] }],
    fotofficeSequence: [{ columnas: ["workspaceId", "key"] }],
    // Como en la migración: uno común y dos parciales (con año / sin año).
    fotofficeRecordNumber: [
      { columnas: ["entityType", "entityId"] },
      { columnas: ["workspaceId", "sequenceKey", "year", "value"], aplica: (f) => f.year !== null && f.year !== undefined },
      { columnas: ["workspaceId", "sequenceKey", "value"], aplica: (f) => f.year === null || f.year === undefined },
    ],
  };

  function verificarUnicidad(tabla: Tabla, f: Fila) {
    for (const u of UNICOS[tabla] ?? []) {
      if (u.aplica && !u.aplica(f)) continue;
      const choca = datos[tabla].some((x) => x !== f && (!u.aplica || u.aplica(x)) && u.columnas.every((c) => x[c] === f[c]));
      if (choca) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    }
  }

  function insertar(tabla: Tabla, data: Fila): Fila {
    const f: Fila = { id: `${tabla}-${++secuencia}`, ...(DEFECTOS[tabla]?.() ?? {}), ...(clonar(data) as Fila) };
    verificarUnicidad(tabla, f);
    datos[tabla].push(f);
    return f;
  }

  function delegado(tabla: Tabla) {
    return {
      findFirst: async (a: { where?: Where; select?: Record<string, boolean>; orderBy?: Orden | Orden[] } = {}) => {
        const f = ordenar(datos[tabla].filter((x) => cumple(x, a.where)), a.orderBy)[0];
        return f ? elegir(f, a.select) : null;
      },
      findMany: async (a: { where?: Where; select?: Record<string, boolean>; orderBy?: Orden | Orden[]; take?: number } = {}) =>
        ordenar(datos[tabla].filter((x) => cumple(x, a.where)), a.orderBy).slice(0, a.take ?? Infinity).map((x) => elegir(x, a.select)),
      count: async (a: { where?: Where } = {}) => datos[tabla].filter((x) => cumple(x, a.where)).length,
      /** Mínimo: agrupa por columnas y sólo admite `_count: true` (cantidad de filas por grupo). */
      groupBy: async (a: { by: string[]; where?: Where; _count?: true }) => {
        const grupos = new Map<string, Fila>();
        for (const x of datos[tabla].filter((f) => cumple(f, a.where))) {
          const clave = JSON.stringify(a.by.map((c) => x[c] ?? null));
          const g = grupos.get(clave) ?? { ...Object.fromEntries(a.by.map((c) => [c, x[c] ?? null])), _count: 0 };
          g._count = (g._count as number) + 1;
          grupos.set(clave, g);
        }
        return [...grupos.values()];
      },
      create: async (a: { data: Fila; select?: Record<string, boolean> }) => elegir(insertar(tabla, a.data), a.select),
      /** Con `skipDuplicates` (ON CONFLICT DO NOTHING) saltea las filas que chocan con un único. */
      createMany: async (a: { data: Fila[]; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const d of a.data) {
          try {
            insertar(tabla, d);
            count++;
          } catch (e) {
            if (!a.skipDuplicates || (e as { code?: unknown }).code !== "P2002") throw e;
          }
        }
        return { count };
      },
      updateMany: async (a: { where?: Where; data: Fila }) => {
        const hits = datos[tabla].filter((x) => cumple(x, a.where));
        for (const h of hits) {
          Object.assign(h, clonar(a.data));
          verificarUnicidad(tabla, h);
        }
        return { count: hits.length };
      },
      deleteMany: async (a: { where?: Where } = {}) => {
        const antes = datos[tabla].length;
        datos[tabla] = datos[tabla].filter((x) => !cumple(x, a.where));
        return { count: antes - datos[tabla].length };
      },
    };
  }

  type Delegado = ReturnType<typeof delegado>;
  /** Los métodos reales de cada tabla. Lo usan el `prisma` global y cada `tx`. */
  const tablas = Object.fromEntries(TABLAS.map((t) => [t, delegado(t)])) as Record<Tabla, Delegado>;
  let abiertas = 0;

  /** Cliente que llama a `tablas` en el momento (así ve los reemplazos) si `permitido()` lo deja. */
  /** SQL crudo recibido (`$executeRaw` sólo se registra: el bloqueo de la base real acá no hace nada). */
  const sql: { texto: string; valores: unknown[] }[] = [];
  /** Se llama con cada SQL crudo, dentro de la transacción: sirve para simular otra corrida. */
  const ganchos: { alEjecutarSql: ((texto: string, valores: unknown[]) => void) | null } = { alEjecutarSql: null };

  function cliente(permitido: () => string | null): Record<string, unknown> {
    const c: Record<string, unknown> = Object.fromEntries(
      TABLAS.map((t) => [
        t,
        new Proxy({}, {
          get: (_o, metodo: string) => async (...args: unknown[]) => {
            const error = permitido();
            if (error) throw new Error(error);
            return (tablas[t] as unknown as Record<string, (...a: unknown[]) => unknown>)[metodo]!(...args);
          },
        }),
      ]),
    );
    c.$executeRaw = async (partes: TemplateStringsArray, ...valores: unknown[]) => {
      const error = permitido();
      if (error) throw new Error(error);
      const texto = partes.join("$");
      sql.push({ texto, valores });
      ganchos.alEjecutarSql?.(texto, valores);
      return 1;
    };
    c.$queryRaw = async (partes: TemplateStringsArray, ...valores: unknown[]) => {
      const error = permitido();
      if (error) throw new Error(error);
      const texto = partes.join("$");
      sql.push({ texto, valores });
      return emularConsulta(texto, valores);
    };
    return c;
  }

  /**
   * Sólo emula el SQL crudo que el motor usa, reconocido por su comentario; cualquier otro
   * lanza. "consultas-sin-recorrido": consultas del workspace sin ningún recorrido de venta.
   */
  function emularConsulta(texto: string, valores: unknown[]): unknown[] {
    if (texto.includes("numeracion-asignar")) return emularAsignacion(valores);
    if (texto.includes("numeracion-candado")) return emularCandado(valores);
    if (texto.includes("numeracion-anio-anterior")) return emularAnioAnterior(valores);
    if (!texto.includes("consultas-sin-recorrido")) throw new Error("SQL crudo no emulado en la base en memoria");
    const workspaceId = valores[0];
    const sinRecorrido = datos.serviceSalesLead.filter(
      (l) =>
        l.workspaceId === workspaceId &&
        !datos.fotofficeJourney.some(
          (j) => j.workspaceId === l.workspaceId && j.subjectType === "CAPTACION" && j.subjectId === l.id && j.kind === "VENTA",
        ),
    );
    if (texto.includes("consultas-sin-recorrido: cuenta")) return [{ n: BigInt(sinRecorrido.length) }];
    const [, conPerdidas, limite] = valores as [string, boolean, number];
    return ordenar(sinRecorrido.filter((l) => conPerdidas || l.status !== "LOST"), [{ createdAt: "asc" }, { id: "asc" }])
      .slice(0, limite)
      .map((l) => elegir(l, { id: true, status: true, createdAt: true, updatedAt: true }));
  }

  /**
   * "numeracion-candado": el SELECT … FOR UPDATE de `lib/numeracion/asignar.ts` (acá no hay
   * concurrencia: sólo lee). Parámetros: workspaceId y key.
   */
  function emularCandado(valores: unknown[]): unknown[] {
    const [ws, key] = valores as [string, string];
    const s = datos.fotofficeSequence.find((x) => x.workspaceId === ws && x.key === key);
    if (!s) return [];
    return [{ prefix: s.prefix, withYear: s.withYear, digits: s.digits, currentYear: s.currentYear === null ? null : BigInt(s.currentYear as number) }];
  }

  /**
   * "numeracion-anio-anterior": MAX(value) + 1 de los números de ese año. Parámetros: workspaceId,
   * key y año. Devuelve `value` como bigint.
   */
  function emularAnioAnterior(valores: unknown[]): unknown[] {
    const [ws, key, anio] = valores as [string, string, number];
    const usados = datos.fotofficeRecordNumber
      .filter((r) => r.workspaceId === ws && r.sequenceKey === key && r.year === anio)
      .map((r) => r.value as number);
    return [{ value: BigInt(Math.max(0, ...usados) + 1) }];
  }

  /**
   * "numeracion-asignar": el UPDATE … RETURNING de `lib/numeracion/asignar.ts`. Parámetros: el
   * año (CASE, subconsulta, currentYear), workspaceId, key y el año de la condición final (no
   * actualiza si la secuencia lleva año y su año es posterior). Devuelve lo mismo que el
   * RETURNING (con `value` y `year` como bigint, como puede llegar de Prisma).
   */
  function emularAsignacion(valores: unknown[]): unknown[] {
    const [anio, , , ws, key, anioCondicion] = valores as [number, number, number, string, string, number];
    const s = datos.fotofficeSequence.find((x) => x.workspaceId === ws && x.key === key);
    if (!s) return [];
    if (s.withYear && s.currentYear !== null && (s.currentYear as number) > anioCondicion) return [];
    if (s.withYear && s.currentYear !== anio) {
      const usados = datos.fotofficeRecordNumber
        .filter((r) => r.workspaceId === ws && r.sequenceKey === key && r.year === anio)
        .map((r) => r.value as number);
      s.nextValue = Math.max(0, ...usados) + 2;
    } else {
      s.nextValue = (s.nextValue as number) + 1;
    }
    s.currentYear = s.withYear ? anio : null;
    return [{
      value: BigInt((s.nextValue as number) - 1),
      year: s.currentYear === null ? null : BigInt(s.currentYear as number),
      prefix: s.prefix, withYear: s.withYear, digits: s.digits,
    }];
  }

  const FUERA = "uso de prisma fuera de la transacción";
  const prisma: Record<string, unknown> = cliente(() => (abiertas > 0 ? FUERA : null));
  prisma.$transaction = async (fn: (tx: unknown) => Promise<unknown>, opciones?: unknown) => {
    if (abiertas > 0) throw new Error(FUERA);
    transacciones.push({ opciones });
    const foto = Object.fromEntries(TABLAS.map((t) => [t, datos[t].map((f) => clonar(f) as Fila)])) as Record<Tabla, Fila[]>;
    let viva = true;
    const tx = cliente(() => (viva ? null : "uso de tx con la transacción ya terminada"));
    abiertas++;
    try {
      return await fn(tx);
    } catch (error) {
      for (const t of TABLAS) datos[t] = foto[t];
      throw error;
    } finally {
      viva = false;
      abiertas--;
    }
  };

  return {
    prisma,
    /** Para simular fallas o carreras: reemplazar un método acá lo cambia para `prisma` y para `tx`. */
    tablas,
    sql,
    ganchos,
    datos,
    transacciones,
    /** Inserta una fila de prueba con los valores por defecto de su tabla. */
    agregar: (tabla: Tabla, fila: Fila) => insertar(tabla, fila),
    vaciar: () => {
      for (const t of TABLAS) datos[t] = [];
      transacciones.length = 0;
      abiertas = 0;
      sql.length = 0;
      ganchos.alEjecutarSql = null;
    },
  };
}
