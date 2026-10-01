import { readFileSync } from "node:fs";
import type { ClaveSecuencia } from "./secuencias";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const A = await import("./asignar");
const S = await import("./secuencias");

type Tx = Parameters<typeof A.asignarNumero>[0];
const prisma = B.prisma as unknown as { $transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> };

const ADMIN = { workspaceId: "ws-1", userId: 1, userLabel: "Ana", role: "ADMIN" };
/** 1/10/2026 al mediodía de Buenos Aires. */
const HOY = new Date("2026-10-01T12:00:00-03:00");

let n = 0;
async function numerar(key: ClaveSecuencia = "CONSULTA", fecha = HOY, workspaceId = "ws-1", entityId = `e-${++n}`) {
  return prisma.$transaction((tx) => A.asignarNumero(tx, { workspaceId, key, entityType: key, entityId, fecha }));
}
const secuencia = (key: string, ws = "ws-1") => B.datos.fotofficeSequence.find((s) => s.key === key && s.workspaceId === ws)!;

beforeEach(() => {
  B.vaciar();
  n = 0;
});

describe("asignarNumero", () => {
  it("crea las secuencias la primera vez y numera en orden", async () => {
    expect((await numerar()).display).toBe("2026-0001");
    expect(await numerar()).toEqual({ year: 2026, value: 2, display: "2026-0002" });
    expect((await numerar("PRESUPUESTO")).display).toBe("1");
    expect((await numerar("PRESUPUESTO")).display).toBe("2");
    expect(B.datos.fotofficeSequence).toHaveLength(5);
    expect(B.datos.fotofficeRecordNumber).toHaveLength(4);
  });

  it("varias altas seguidas nunca repiten número", async () => {
    // La base en memoria no abre dos transacciones a la vez; la exclusión real la da el candado de fila.
    const rs = [];
    for (let i = 0; i < 10; i++) rs.push(await numerar());
    expect(new Set(rs.map((r) => r.value)).size).toBe(10);
  });

  it("reinicia en 1 con el año nuevo de Buenos Aires, no el de UTC", async () => {
    await numerar();
    // 1/1/2027 a las 02:00 UTC todavía es 31/12/2026 en Argentina.
    expect((await numerar("CONSULTA", new Date("2027-01-01T02:00:00Z"))).display).toBe("2026-0002");
    expect((await numerar("CONSULTA", new Date("2027-01-01T00:30:00-03:00"))).display).toBe("2027-0001");
    expect((await numerar("CONSULTA", new Date("2027-03-01T10:00:00-03:00"))).display).toBe("2027-0002");
  });

  it("una consulta vieja de otro año toma su año, y al volver sigue después del último usado", async () => {
    await numerar();
    await numerar();
    expect((await numerar("CONSULTA", new Date("2025-05-01T10:00:00-03:00"))).display).toBe("2025-0001");
    expect((await numerar()).display).toBe("2026-0003");
  });

  it("numerar un año anterior no toca la secuencia", async () => {
    await numerar();
    await numerar();
    const antes = { ...secuencia("CONSULTA") };
    expect((await numerar("CONSULTA", new Date("2025-05-01T10:00:00-03:00"))).display).toBe("2025-0001");
    expect((await numerar("CONSULTA", new Date("2025-06-01T10:00:00-03:00"))).display).toBe("2025-0002");
    expect((await numerar("CONSULTA", new Date("2024-02-01T10:00:00-03:00"))).display).toBe("2024-0001");
    expect(secuencia("CONSULTA")).toMatchObject({ nextValue: antes.nextValue, currentYear: 2026 });
    expect(secuencia("CONSULTA").nextValue).toBe(3);
  });

  it("después de numerar un año anterior, el año corriente sigue su contador", async () => {
    await numerar();
    await numerar("CONSULTA", new Date("2025-05-01T10:00:00-03:00"));
    expect(await numerar()).toEqual({ year: 2026, value: 2, display: "2026-0002" });
    expect(await numerar()).toEqual({ year: 2026, value: 3, display: "2026-0003" });
  });

  it("un próximo número configurado no se pierde al numerar un año anterior", async () => {
    expect(await S.configurarSecuencia(ADMIN, "CONSULTA", { prefix: "", withYear: true, digits: 4, nextValue: 42 }, HOY)).toEqual({ ok: true });
    expect((await numerar("CONSULTA", new Date("2025-05-01T10:00:00-03:00"))).display).toBe("2025-0001");
    expect((await numerar()).display).toBe("2026-0042");
    expect((await numerar()).display).toBe("2026-0043");
  });

  it("sin año no reinicia", async () => {
    await numerar("PEDIDO", new Date("2026-12-31T10:00:00-03:00"));
    expect((await numerar("PEDIDO", new Date("2027-01-02T10:00:00-03:00"))).display).toBe("2");
    expect(secuencia("PEDIDO").currentYear).toBeNull();
  });

  it("un registro ya numerado devuelve su número sin consumir otro", async () => {
    const a = await numerar("CONSULTA", HOY, "ws-1", "lead-1");
    const b = await numerar("CONSULTA", HOY, "ws-1", "lead-1");
    expect(b).toEqual(a);
    expect(secuencia("CONSULTA").nextValue).toBe(2);
    expect(B.datos.fotofficeRecordNumber).toHaveLength(1);
  });

  it("si la transacción del llamador se deshace, el número no se consume", async () => {
    await numerar();
    await expect(
      prisma.$transaction(async (tx) => {
        await A.asignarNumero(tx, { workspaceId: "ws-1", key: "CONSULTA", entityType: "CONSULTA", entityId: "x", fecha: HOY });
        throw new Error("falla el alta");
      }),
    ).rejects.toThrow("falla el alta");
    expect((await numerar()).display).toBe("2026-0002");
  });

  it("usa prefijo y dígitos configurados", async () => {
    const r = await S.configurarSecuencia(ADMIN, "PRESUPUESTO", { prefix: "P-", withYear: true, digits: 4, nextValue: 42 }, HOY);
    expect(r).toEqual({ ok: true });
    expect((await numerar("PRESUPUESTO")).display).toBe("P-2026-0042");
    expect((await numerar("PRESUPUESTO")).display).toBe("P-2026-0043");
  });

  it("aislamiento: cada workspace tiene su secuencia y sus números", async () => {
    await numerar("CONSULTA", HOY, "ws-1", "a");
    await numerar("CONSULTA", HOY, "ws-1", "b");
    expect((await numerar("CONSULTA", HOY, "ws-2", "c")).display).toBe("2026-0001");
    expect(await A.numeroDe("ws-2", "CONSULTA", ["a", "b", "c"])).toEqual(new Map([["c", "2026-0001"]]));
    expect(await A.numeroDe("ws-1", "CONSULTA", ["a", "b", "a"])).toEqual(new Map([["a", "2026-0001"], ["b", "2026-0002"]]));
    expect(await A.numeroDe("ws-1", "CLIENTE", ["a"])).toEqual(new Map());
    // Un registro de otro workspace no se renumera ni se devuelve.
    await expect(numerar("CONSULTA", HOY, "ws-2", "a")).rejects.toThrow("otro workspace");
  });

  it("una clave inventada lanza", async () => {
    await expect(numerar("FACTURA" as ClaveSecuencia)).rejects.toThrow("Secuencia desconocida");
  });
});

describe("el SQL de asignación", () => {
  it("usa parámetros enlazados y sólo columnas que existen en la migración", async () => {
    await numerar("CONSULTA", HOY, "ws-1", "lead-1");
    await numerar("CONSULTA", new Date("2025-05-01T10:00:00-03:00"), "ws-1", "lead-viejo");
    const q = B.sql.find((s) => s.texto.includes("numeracion-asignar"))!;
    const candado = B.sql.find((s) => s.texto.includes("numeracion-candado"))!;
    const anterior = B.sql.find((s) => s.texto.includes("numeracion-anio-anterior"))!;
    expect(q.valores).toEqual([2026, 2026, 2026, "ws-1", "CONSULTA", 2026]);
    expect(candado.valores).toEqual(["ws-1", "CONSULTA"]);
    expect(candado.texto).toContain("FOR UPDATE");
    expect(anterior.valores).toEqual(["ws-1", "CONSULTA", 2025]);
    // El año anterior no actualiza la secuencia: hubo un solo UPDATE.
    expect(B.sql.filter((s) => s.texto.includes("numeracion-asignar"))).toHaveLength(1);
    for (const x of [q, candado, anterior]) {
      expect(x.texto).not.toContain("ws-1");
      expect(x.texto).not.toMatch(/202[56]/);
    }

    const migracion = readFileSync(
      resolve(__dirname, "../../../../packages/db/prisma/migrations/20261004120000_fotoffice_campos_y_numeracion/migration.sql"),
      "utf8",
    );
    const tabla = (nombre: string) => migracion.match(new RegExp(`CREATE TABLE "${nombre}" \\(([\\s\\S]*?)\\n\\);`))![1]!;
    const columnas = new Set(
      [tabla("FotofficeSequence"), tabla("FotofficeRecordNumber")].flatMap((t) => [...t.matchAll(/^\s+"(\w+)"/gm)].map((m) => m[1]!)),
    );
    const usados = [q, candado, anterior].flatMap((x) => [...x.texto.matchAll(/"(\w+)"/g)].map((m) => m[1]!));
    const alias = new Set(["value", "year"]); // nombres de salida del RETURNING (también son columnas)
    for (const u of usados) {
      if (u === "FotofficeSequence" || u === "FotofficeRecordNumber") continue;
      expect(columnas.has(u) || alias.has(u), u).toBe(true);
    }
    expect(usados).toEqual(expect.arrayContaining(["FotofficeSequence", "FotofficeRecordNumber", "nextValue", "currentYear", "withYear"]));
  });
});
