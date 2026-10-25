import { describe, expect, it } from "vitest";
import {
  MAX_INTENTOS_HLS,
  estadoHls,
  marcarError,
  marcarFalloHls,
  marcarHls,
  marcarLista,
  marcarPartesBorradas,
  marcarPartesBorradasSinImagen,
  marcarSinImagen,
  renovarLock,
  renovarLockRelleno,
  recuperarTrabadas,
  tomarRelleno,
  tomarSiguiente,
  type PrismaCola,
  type PrismaRelleno,
} from "./cola";

type Llamada = { sql: string; params: unknown[] };

function falso(filas: unknown[] = [], afectadas = 0) {
  const queries: Llamada[] = [];
  const execs: Llamada[] = [];
  const prisma: PrismaCola = {
    $queryRawUnsafe: (async (sql: string, ...params: unknown[]) => {
      queries.push({ sql, params });
      return filas;
    }) as PrismaCola["$queryRawUnsafe"],
    $executeRawUnsafe: (async (sql: string, ...params: unknown[]) => {
      execs.push({ sql, params });
      return afectadas;
    }) as PrismaCola["$executeRawUnsafe"],
  };
  return { prisma, queries, execs };
}

const ahora = new Date("2026-11-30T12:00:00.000Z");
const min = 60_000;

describe("tomarSiguiente", () => {
  it("usa los tres instantes exactos y SKIP LOCKED", async () => {
    const { prisma, queries } = falso([{ id: "g1" }]);
    const t = await tomarSiguiente(prisma, ahora);
    expect(t).toEqual({ id: "g1", lockAt: ahora });
    const [q] = queries;
    expect(q.sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(q.sql).toContain("g.estado='COMPLETA'");
    expect(q.params).toEqual([
      ahora,
      new Date(ahora.getTime() - 15 * min),
      new Date(ahora.getTime() - 30 * min),
    ]);
  });
  it("devuelve null si no hay nada", async () => {
    expect(await tomarSiguiente(falso([]).prisma, ahora)).toBeNull();
  });
});

describe("recuperarTrabadas", () => {
  it("usa ahora - 6 h y el umbral de 3 intentos", async () => {
    const { prisma, execs } = falso([], 2);
    const n = await recuperarTrabadas(prisma, ahora);
    expect(n).toBe(4);
    const corte = new Date(ahora.getTime() - 6 * 60 * min);
    expect(execs).toHaveLength(2);
    expect(execs[0].sql).toContain(`"conversionIntentos" >= 3`);
    expect(execs[0].sql).toContain("'ERROR'");
    expect(execs[0].params).toContainEqual(corte);
    expect(execs[1].sql).toContain(`"conversionIntentos" < 3`);
    expect(execs[1].sql).toContain("'PENDIENTE'");
    expect(execs[1].params).toEqual([corte]);
  });
});

describe("marcadores (exigen ser dueños)", () => {
  const lock = new Date("2026-11-30T11:00:00.000Z");
  it("marcarLista pasa videoBytes como BigInt, exige el token y devuelve las filas", async () => {
    const { prisma, execs } = falso([], 1);
    const n = await marcarLista(prisma, "g1", lock, { videoKey: "k", videoBytes: 123, videoDuracionSeg: 60 });
    expect(n).toBe(1);
    expect(execs[0].sql).toContain("'LISTA'");
    expect(execs[0].sql).toContain(`"conversionEstado"='PROCESANDO' AND "conversionLockAt"=$6`);
    expect(execs[0].params).toContain(BigInt(123));
    expect(execs[0].params[5]).toEqual(lock);
    // La conversión no sabe nada del HLS (E10): lo arma sólo el relleno.
    expect(execs[0].sql).not.toContain("hlsKey");
    expect(execs[0].params).toHaveLength(6);
  });
  it("marcarLista devuelve 0 si otro es el dueño", async () => {
    expect(await marcarLista(falso([], 0).prisma, "g1", lock, { videoKey: "k", videoBytes: 1, videoDuracionSeg: 1 })).toBe(0);
  });
  it("marcarError guarda el mensaje y exige el token", async () => {
    const { prisma, execs } = falso([], 1);
    expect(await marcarError(prisma, "g1", lock, "falló")).toBe(1);
    expect(execs[0].sql).toContain("'ERROR'");
    expect(execs[0].sql).toContain(`"conversionLockAt"=$3`);
    expect(execs[0].params).toEqual(["g1", "falló", lock]);
  });
  it("marcarSinImagen exige el token", async () => {
    const { prisma, execs } = falso([], 1);
    await marcarSinImagen(prisma, "g1", lock);
    expect(execs[0].sql).toContain("'SIN_IMAGEN'");
    expect(execs[0].sql).toContain(`"conversionLockAt"=$2`);
    expect(execs[0].params).toEqual(["g1", lock]);
  });
  it("marcarPartesBorradas exige LISTA y la misma videoKey", async () => {
    const { prisma, execs } = falso([], 1);
    await marcarPartesBorradas(prisma, "g1", "k.mp4");
    expect(execs[0].sql).toContain(`"partesBorradasAt"`);
    expect(execs[0].sql).toContain(`"conversionEstado"='LISTA' AND "videoKey"=$3`);
    expect(execs[0].params[1]).toBeInstanceOf(Date);
    expect(execs[0].params).toContain("k.mp4");
  });
  it("marcarPartesBorradasSinImagen exige SIN_IMAGEN", async () => {
    const { prisma, execs } = falso([], 1);
    await marcarPartesBorradasSinImagen(prisma, "g1");
    expect(execs[0].sql).toContain(`"conversionEstado"='SIN_IMAGEN'`);
  });
  it("renovarLock cambia el token sólo si sigue siendo el viejo", async () => {
    const { prisma, execs } = falso([], 1);
    const nuevo = new Date("2026-11-30T11:05:00.000Z");
    expect(await renovarLock(prisma, "g1", lock, nuevo)).toBe(1);
    expect(execs[0].sql).toContain(`SET "conversionLockAt"=$3`);
    expect(execs[0].sql).toContain(`"conversionLockAt"=$2`);
    expect(execs[0].params).toEqual(["g1", lock, nuevo]);
  });
});

describe("relleno de la versión para mirar", () => {
  const lock = new Date("2026-11-30T11:00:00.000Z");
  /** Transacción falsa: responde en orden al candado, a "¿hay otro rellenando?" y a la toma. */
  function conTransaccion(candado: boolean, enCurso: unknown[], tomada: unknown[]) {
    const queries: Llamada[] = [];
    const respuestas = [[{ ok: candado }], enCurso, tomada];
    const tx: PrismaCola = {
      $queryRawUnsafe: (async (sql: string, ...params: unknown[]) => {
        queries.push({ sql, params });
        return respuestas[queries.length - 1] ?? [];
      }) as PrismaCola["$queryRawUnsafe"],
      $executeRawUnsafe: (async () => 0) as PrismaCola["$executeRawUnsafe"],
    };
    let transacciones = 0;
    const prisma: PrismaRelleno = { ...tx, $transaction: async (fn) => { transacciones++; return fn(tx); } };
    return { prisma, queries, transacciones: () => transacciones };
  }

  it("tomarRelleno: un solo relleno en todo el sistema (candado de transacción) y la toma con todos los filtros", async () => {
    const { prisma, queries, transacciones } = conTransaccion(true, [], [{ id: "g9" }]);
    const t = await tomarRelleno(prisma, ahora);
    expect(t).toEqual({ id: "g9", lockAt: ahora });
    expect(transacciones()).toBe(1);
    expect(queries[0]!.sql).toContain("pg_try_advisory_xact_lock");
    // ¿Otro está rellenando? Intento sin causa todavía y bloqueo renovado hace menos de 30 min.
    expect(queries[1]!.sql).toContain(`"conversionError" ~ '^HLS:[0-9]+:$'`);
    expect(queries[1]!.params).toEqual([new Date(ahora.getTime() - 30 * min)]);
    const { sql, params } = queries[2]!;
    expect(sql).toContain(`g."conversionEstado"='LISTA'`);
    expect(sql).toContain(`g.estado='COMPLETA'`);
    expect(sql).toContain(`g."videoKey" IS NOT NULL`);
    expect(sql).toContain(`g."hlsKey" IS NULL`);
    expect(sql).toContain(`g."videoBorradoAt" IS NULL`);
    expect(sql).toContain(`(g."conversionLockAt" IS NULL OR g."conversionLockAt" < $2)`);
    expect(sql).toContain(`< ${MAX_INTENTOS_HLS}`);
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    // Entregas vencidas o ya borradas: no se gasta CPU en algo que se va a borrar.
    expect(sql).toContain(`e."videosVencenAt" < $1 OR e."videosBorradosAt" IS NOT NULL`);
    // Cuenta el intento al tomarla: tres cortes seguidos también la sacan de la cola.
    expect(sql).toContain(`'HLS:' || (`);
    expect(params).toEqual([ahora, new Date(ahora.getTime() - 30 * min)]);
    expect(MAX_INTENTOS_HLS).toBe(3);
  });
  it("tomarRelleno: si otra ejecución tiene el candado o ya está rellenando, no toma nada", async () => {
    const a = conTransaccion(false, [], [{ id: "g9" }]);
    expect(await tomarRelleno(a.prisma, ahora)).toBeNull();
    expect(a.queries).toHaveLength(1);
    const b = conTransaccion(true, [{ id: "g3" }], [{ id: "g9" }]);
    expect(await tomarRelleno(b.prisma, ahora)).toBeNull();
    expect(b.queries).toHaveLength(2);
  });
  it("tomarRelleno con id: encadena el relleno de la grabación recién convertida", async () => {
    const { prisma, queries } = conTransaccion(true, [], [{ id: "g1" }]);
    expect(await tomarRelleno(prisma, ahora, "g1")).toEqual({ id: "g1", lockAt: ahora });
    expect(queries[2]!.sql).toContain("g.id=$3");
    expect(queries[2]!.params).toEqual([ahora, new Date(ahora.getTime() - 30 * min), "g1"]);
  });
  it("tomarRelleno devuelve null si no hay nada", async () => {
    expect(await tomarRelleno(conTransaccion(true, [], []).prisma, ahora)).toBeNull();
  });
  it("renovarLockRelleno exige LISTA, sin HLS y el token viejo", async () => {
    const { prisma, execs } = falso([], 1);
    const nuevo = new Date("2026-11-30T11:05:00.000Z");
    expect(await renovarLockRelleno(prisma, "g1", lock, nuevo)).toBe(1);
    expect(execs[0].sql).toContain(`"conversionEstado"='LISTA' AND "hlsKey" IS NULL AND "conversionLockAt"=$2`);
    expect(execs[0].params).toEqual(["g1", lock, nuevo]);
  });
  it("marcarHls exige el token, que siga sin HLS y que el video no se haya borrado; limpia el contador", async () => {
    const { prisma, execs } = falso([], 1);
    expect(await marcarHls(prisma, "g1", lock, "digitalizacion/ws/g1/hls")).toBe(1);
    expect(execs[0].sql).toContain(`SET "hlsKey"=$2, "conversionError"=NULL`);
    expect(execs[0].sql).toContain(`"videoBorradoAt" IS NULL`);
    expect(execs[0].sql).toContain(`"conversionLockAt"=$3`);
    expect(execs[0].params).toEqual(["g1", "digitalizacion/ws/g1/hls", lock]);
  });
  it("marcarFalloHls conserva el contador y agrega la causa (nunca vacía: vacía = en curso)", async () => {
    const vacia = falso([], 1);
    await marcarFalloHls(vacia.prisma, "g1", lock, "  ");
    expect(vacia.execs[0].params[1]).toBe("sin detalle");
    const { prisma, execs } = falso([], 1);
    await marcarFalloHls(prisma, "g1", lock, "ffmpeg falló");
    expect(execs[0].sql).toContain(`substring("conversionError" from`);
    expect(execs[0].sql).toContain(`"conversionEstado"='LISTA' AND "hlsKey" IS NULL AND "conversionLockAt"=$3`);
    expect(execs[0].params).toEqual(["g1", "ffmpeg falló", lock]);
  });
  it("estadoHls lee la carpeta HLS actual", async () => {
    expect(await estadoHls(falso([{ hlsKey: "x/hls" }]).prisma, "g1")).toBe("x/hls");
    expect(await estadoHls(falso([]).prisma, "g1")).toBeNull();
  });
});
