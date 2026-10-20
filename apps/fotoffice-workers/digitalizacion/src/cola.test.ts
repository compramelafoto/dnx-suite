import { describe, expect, it } from "vitest";
import {
  marcarError,
  marcarLista,
  marcarPartesBorradas,
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
    const id = await tomarSiguiente(prisma, ahora);
    expect(id).toBe("g1");
    const [q] = queries;
    expect(q.sql).toContain("FOR UPDATE SKIP LOCKED");
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

describe("marcadores", () => {
  it("marcarLista pasa videoBytes como BigInt", async () => {
    const { prisma, execs } = falso();
    await marcarLista(prisma, "g1", { videoKey: "k", videoBytes: 123, videoDuracionSeg: 60 });
    expect(execs[0].sql).toContain("'LISTA'");
    expect(execs[0].params).toContain(BigInt(123));
    expect(execs[0].params).toContain("g1");
  });
  it("marcarError guarda el mensaje", async () => {
    const { prisma, execs } = falso();
    await marcarError(prisma, "g1", "falló");
    expect(execs[0].sql).toContain("'ERROR'");
    expect(execs[0].params).toEqual(["g1", "falló"]);
  });
  it("marcarPartesBorradas", async () => {
    const { prisma, execs } = falso();
    await marcarPartesBorradas(prisma, "g1");
    expect(execs[0].sql).toContain(`"partesBorradasAt"`);
    expect(execs[0].params[1]).toBeInstanceOf(Date);
    expect(execs[0].params).toContain("g1");
  });
});
