import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClaveSecuencia } from "./secuencias";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const S = await import("./secuencias");
const A = await import("./asignar");

type Tx = Parameters<typeof A.asignarNumero>[0];
const prisma = B.prisma as unknown as { $transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> };

const ADMIN = { workspaceId: "ws-1", userId: 1, userLabel: "Ana", role: "ADMIN" };
const EQUIPO = { ...ADMIN, role: "STAFF" };
const HOY = new Date("2026-10-01T12:00:00-03:00");
const USADO = "No se puede volver a un número ya usado.";

let n = 0;
async function numerar(key: ClaveSecuencia, fecha = HOY, workspaceId = "ws-1") {
  return prisma.$transaction((tx) => A.asignarNumero(tx, { workspaceId, key, entityType: key, entityId: `e-${++n}`, fecha }));
}
const config = (c: Partial<{ prefix: unknown; withYear: unknown; digits: unknown; nextValue: unknown }> = {}) => ({
  prefix: "", withYear: false, digits: 1, nextValue: 1, ...c,
});

beforeEach(() => {
  B.vaciar();
  n = 0;
});

describe("asegurarSecuencias", () => {
  it("crea las siete con sus valores iniciales y es idempotente", async () => {
    await S.asegurarSecuencias("ws-1");
    await S.asegurarSecuencias("ws-1");
    expect(B.datos.fotofficeSequence).toHaveLength(7);
    const consulta = B.datos.fotofficeSequence.find((s) => s.key === "CONSULTA")!;
    expect(consulta).toMatchObject({ withYear: true, digits: 4, nextValue: 1, prefix: "" });
    const pedido = B.datos.fotofficeSequence.find((s) => s.key === "PEDIDO")!;
    expect(pedido).toMatchObject({ withYear: true, digits: 4, nextValue: 1, prefix: "" });
    const recibo = B.datos.fotofficeSequence.find((s) => s.key === "RECIBO")!;
    expect(recibo).toMatchObject({ withYear: true, digits: 4, nextValue: 1, prefix: "" });
  });

  it("completa sólo las que faltan", async () => {
    B.agregar("fotofficeSequence", { workspaceId: "ws-1", key: "PEDIDO", nextValue: 2025095 });
    await S.asegurarSecuencias("ws-1");
    expect(B.datos.fotofficeSequence).toHaveLength(7);
    expect(B.datos.fotofficeSequence.find((s) => s.key === "PEDIDO")!.nextValue).toBe(2025095);
  });
});

describe("vistaPrevia", () => {
  it("con y sin año, prefijo y dígitos", () => {
    expect(S.vistaPrevia({ prefix: "P-", withYear: true, digits: 4, nextValue: 42 }, HOY)).toBe("P-2026-0042");
    expect(S.vistaPrevia({ prefix: "", withYear: false, digits: 1, nextValue: 2025262 }, HOY)).toBe("2025262");
    // El año ya cambió: el próximo es el 1 del año nuevo.
    expect(S.vistaPrevia({ prefix: "", withYear: true, digits: 4, nextValue: 90, currentYear: 2025 }, HOY)).toBe("2026-0001");
    // Año de Buenos Aires.
    expect(S.vistaPrevia({ prefix: "", withYear: true, digits: 2, nextValue: 3 }, new Date("2027-01-01T02:00:00Z"))).toBe("2026-03");
  });

  it("al cambiar de año sigue después del último usado de ese año, como la asignación", () => {
    const cfg = { prefix: "", withYear: true, digits: 4, nextValue: 90, currentYear: 2025 };
    expect(S.vistaPrevia(cfg, HOY, 7)).toBe("2026-0008");
    // currentYear null (nunca numeró con año) también arranca desde el último usado + 1.
    expect(S.vistaPrevia({ ...cfg, currentYear: null }, HOY, 3)).toBe("2026-0004");
    // Mismo año: manda nextValue, el último usado no importa.
    expect(S.vistaPrevia({ ...cfg, currentYear: 2026 }, HOY, 7)).toBe("2026-0090");
  });
});

describe("leerSecuencias", () => {
  it("devuelve las cinco en orden con el próximo número y el mínimo configurable", async () => {
    await numerar("CONSULTA");
    await numerar("CONSULTA");
    const ls = await S.leerSecuencias("ws-1", HOY);
    expect(ls.map((s) => s.key)).toEqual(["CONSULTA", "PRESUPUESTO", "PEDIDO", "CONTRATO", "PROYECTO", "RECIBO", "GALERIA"]);
    expect(ls[0]).toMatchObject({ proximo: 3, minimoProximo: 3, vistaPrevia: "2026-0003" });
    // Al año siguiente la secuencia con año arranca de nuevo.
    const enero = await S.leerSecuencias("ws-1", new Date("2027-01-05T10:00:00-03:00"));
    expect(enero[0]).toMatchObject({ proximo: 1, minimoProximo: 1, vistaPrevia: "2027-0001" });
  });

  it("la vista previa coincide con lo que asigna cuando el año nuevo ya tiene números", async () => {
    B.agregar("fotofficeSequence", { workspaceId: "ws-1", key: "CONSULTA", withYear: true, digits: 4, nextValue: 90, currentYear: 2025 });
    B.agregar("fotofficeRecordNumber", {
      workspaceId: "ws-1", sequenceKey: "CONSULTA", entityType: "CONSULTA", entityId: "viejo", year: 2026, value: 5, display: "2026-0005",
    });
    const [consulta] = await S.leerSecuencias("ws-1", HOY);
    expect(consulta).toMatchObject({ proximo: 6, minimoProximo: 6, vistaPrevia: "2026-0006" });
    expect((await numerar("CONSULTA")).display).toBe("2026-0006");
  });
});

describe("configurarSecuencia", () => {
  it("exige `configurar` y no toca nada sin permiso", async () => {
    await S.asegurarSecuencias("ws-1");
    const antes = JSON.stringify(B.datos);
    expect(await S.configurarSecuencia(EQUIPO, "PEDIDO", config({ nextValue: 9 }), HOY)).toEqual({
      ok: false, error: S.MENSAJES_NUMERACION.sinPermiso,
    });
    expect(JSON.stringify(B.datos)).toBe(antes);
  });

  it("rechaza una clave inventada", async () => {
    expect(await S.configurarSecuencia(ADMIN, "FACTURA", config(), HOY)).toEqual({ ok: false, error: S.MENSAJES_NUMERACION.noEncontrada });
  });

  it("no deja volver a un número ya usado (sin año: todos los usados)", async () => {
    await numerar("PEDIDO");
    await numerar("PEDIDO");
    await numerar("PEDIDO");
    expect(await S.configurarSecuencia(ADMIN, "PEDIDO", config({ nextValue: 3 }), HOY)).toEqual({ ok: false, error: USADO });
    expect(await S.configurarSecuencia(ADMIN, "PEDIDO", config({ nextValue: 4, prefix: "PD-" }), HOY)).toEqual({ ok: true });
    expect((await numerar("PEDIDO")).display).toBe("PD-4");
  });

  it("con año mira sólo los usados del año corriente", async () => {
    await numerar("CONSULTA", new Date("2025-06-01T10:00:00-03:00"));
    await numerar("CONSULTA", new Date("2025-06-02T10:00:00-03:00"));
    await numerar("CONSULTA");
    const base = { withYear: true, digits: 4 };
    expect(await S.configurarSecuencia(ADMIN, "CONSULTA", config({ ...base, nextValue: 1 }), HOY)).toEqual({ ok: false, error: USADO });
    expect(await S.configurarSecuencia(ADMIN, "CONSULTA", config({ ...base, nextValue: 2 }), HOY)).toEqual({ ok: true });
    expect((await numerar("CONSULTA")).display).toBe("2026-0002");
    // Pasar a sin año cuenta todos los usados (el mayor es 2).
    expect(await S.configurarSecuencia(ADMIN, "CONSULTA", config({ nextValue: 2 }), HOY)).toEqual({ ok: false, error: USADO });
  });

  it("el próximo número configurado con año vale para el año corriente (no reinicia en 1)", async () => {
    expect(await S.configurarSecuencia(ADMIN, "CONTRATO", config({ withYear: true, digits: 3, nextValue: 50 }), HOY)).toEqual({ ok: true });
    expect((await numerar("CONTRATO")).display).toBe("2026-050");
  });

  it("valida el formato con los mensajes de formato.ts", async () => {
    const r = await S.configurarSecuencia(ADMIN, "PEDIDO", config({ prefix: "con espacio" }), HOY);
    expect(r.ok).toBe(false);
    const d = await S.configurarSecuencia(ADMIN, "PEDIDO", config({ digits: 9 }), HOY);
    expect(d).toEqual({ ok: false, error: "Los dígitos tienen que estar entre 1 y 8." });
  });

  it("registra cada cambio con antes, después y quién; sin cambios no registra", async () => {
    await S.configurarSecuencia(ADMIN, "PRESUPUESTO", config({ prefix: "P-", withYear: true, digits: 4, nextValue: 7 }), HOY);
    await S.configurarSecuencia(ADMIN, "PRESUPUESTO", config({ prefix: "P-", withYear: true, digits: 4, nextValue: 7 }), HOY);
    expect(B.datos.fotofficeSequenceChange).toHaveLength(1);
    expect(B.datos.fotofficeSequenceChange[0]).toMatchObject({
      workspaceId: "ws-1", key: "PRESUPUESTO", actorUserId: 1, actorLabel: "Ana",
      before: { prefix: "", withYear: true, digits: 4, nextValue: 1, currentYear: null },
      after: { prefix: "P-", withYear: true, digits: 4, nextValue: 7, currentYear: 2026 },
    });
    const h = await S.historialSecuencia("ws-1", "PRESUPUESTO");
    expect(h).toHaveLength(1);
    expect(await S.historialSecuencia("ws-2", "PRESUPUESTO")).toEqual([]);
  });

  it("aislamiento: configurar un workspace no toca otro ni mira sus números", async () => {
    for (let i = 0; i < 5; i++) await numerar("PEDIDO", HOY, "ws-2");
    expect(await S.configurarSecuencia(ADMIN, "PEDIDO", config({ nextValue: 2 }), HOY)).toEqual({ ok: true });
    expect(B.datos.fotofficeSequence.find((s) => s.key === "PEDIDO" && s.workspaceId === "ws-2")!.nextValue).toBe(6);
  });
});
