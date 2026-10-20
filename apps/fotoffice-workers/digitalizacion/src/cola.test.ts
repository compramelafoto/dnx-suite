import { describe, expect, it } from "vitest";
import {
  marcarError,
  marcarLista,
  marcarPartesBorradas,
  marcarPartesBorradasSinImagen,
  marcarSinImagen,
  renovarLock,
  recuperarTrabadas,
  tomarSiguiente,
  type PrismaCola,
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
