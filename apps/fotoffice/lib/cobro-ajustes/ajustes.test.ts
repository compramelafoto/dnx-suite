import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ fila: null as unknown, error: null as unknown, errorAuto: null as unknown, upserts: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({
  prisma: {
    fotofficeCobroAjustes: {
      findUnique: async (a: { select?: Record<string, boolean> }) => {
        if (H.error) throw H.error;
        if (H.errorAuto && a.select?.autoAcreditarComprobante) throw H.errorAuto;
        return H.fila;
      },
      upsert: async (a: unknown) => {
        H.upserts.push(a);
        return {};
      },
    },
  },
}));

const { guardarAjustesCobro, leerAjustesCobro } = await import("./ajustes");
const { AJUSTES_COBRO_DE_FABRICA } = await import("./datos");

const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: {} } as never };
const STAFF = { workspaceId: "ws-1", userId: 2, userLabel: "S", role: "STAFF", acceso: { role: "STAFF", levels: { quotes: "MANAGE" } } as never };

beforeEach(() => {
  H.fila = null;
  H.error = null;
  H.errorAuto = null;
  H.upserts = [];
});

describe("leer y guardar los ajustes de cobro", () => {
  it("sin fila: los de fábrica", async () => {
    expect(await leerAjustesCobro("ws-1")).toEqual(AJUSTES_COBRO_DE_FABRICA);
  });

  it("sin la tabla (migración sin aplicar): los de fábrica, sin romper", async () => {
    H.error = Object.assign(new Error("no existe"), { code: "P2021" });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await leerAjustesCobro("ws-1")).toEqual(AJUSTES_COBRO_DE_FABRICA);
    log.mockRestore();
  });

  it("lee el interruptor de la acreditación automática; sin su columna (migración sin aplicar) queda apagado y lo demás se lee igual", async () => {
    const FILA = { autoConfirmarPedido: true, alias: "dnx.estudio.mp", cbuCvu: null, titular: null, cuit: null, banco: null, montoUnico: false };
    H.fila = { ...FILA, autoAcreditarComprobante: true };
    expect(await leerAjustesCobro("ws-1")).toMatchObject({ alias: "dnx.estudio.mp", autoConfirmarPedido: true, autoAcreditarComprobante: true });
    H.fila = FILA;
    H.errorAuto = Object.assign(new Error("no existe la columna"), { code: "P2022" });
    expect(await leerAjustesCobro("ws-1")).toEqual({ ...FILA, autoAcreditarComprobante: false });
  });

  it("el interruptor de la acreditación automática se guarda aparte del de Presupuestos", async () => {
    expect(await guardarAjustesCobro(DUENO as never, { autoAcreditarComprobante: true })).toEqual({ ok: true });
    expect(H.upserts[0]).toMatchObject({ create: { autoAcreditarComprobante: true, autoConfirmarPedido: false } });
  });

  it("guarda validado sólo con `configurar`", async () => {
    expect(await guardarAjustesCobro(STAFF as never, { autoConfirmarPedido: true })).toMatchObject({ ok: false });
    expect(await guardarAjustesCobro(DUENO as never, { alias: "dnx.estudio.mp", autoConfirmarPedido: true })).toEqual({ ok: true });
    expect(H.upserts[0]).toMatchObject({ where: { workspaceId: "ws-1" }, create: { alias: "dnx.estudio.mp", autoConfirmarPedido: true, updatedByUserId: 1 } });
    expect(await guardarAjustesCobro(DUENO as never, { cbuCvu: "1" })).toMatchObject({ ok: false });
  });
});
