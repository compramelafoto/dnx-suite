import { beforeEach, describe, expect, it, vi } from "vitest";

/** Candado de importación por organización, contra la base en memoria. */
const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const L = await import("./bloqueo");
const ANA = { workspaceId: "ws-1", userId: 7, userLabel: "Ana" };
const candados = () => B.datos.fotofficeListActivity.filter((f) => f.kind === L.TIPO_BLOQUEO);

beforeEach(() => B.vaciar());

describe("conBloqueoDeImportacion", () => {
  it("toma el candado con un bloqueo por organización, corre y lo suelta", async () => {
    const r = await L.conBloqueoDeImportacion(ANA, "clientes", async () => {
      expect(candados()).toEqual([expect.objectContaining({ workspaceId: "ws-1", listKey: "importacion", action: "clientes", actorUserId: 7 })]);
      return 42;
    });
    expect(r).toEqual({ ok: true, valor: 42 });
    expect(candados()).toHaveLength(0);
    expect(B.sql.some((q) => q.texto.includes("pg_advisory_xact_lock") && q.valores[0] === "fotoffice-importacion:ws-1")).toBe(true);
  });

  it("una segunda importación mientras corre la primera (clientes o consultas) no corre", async () => {
    const segunda = vi.fn(async () => 1);
    const r = await L.conBloqueoDeImportacion(ANA, "consultas", async () => {
      expect(await L.conBloqueoDeImportacion(ANA, "clientes", segunda)).toEqual({ ok: false, error: L.MENSAJE_IMPORTACION_EN_CURSO });
      expect(await L.conBloqueoDeImportacion(ANA, "consultas", segunda)).toEqual({ ok: false, error: L.MENSAJE_IMPORTACION_EN_CURSO });
      // Otra organización sí puede.
      expect(await L.conBloqueoDeImportacion({ ...ANA, workspaceId: "ws-2" }, "clientes", async () => "otra")).toEqual({ ok: true, valor: "otra" });
      return "primera";
    });
    expect(r).toEqual({ ok: true, valor: "primera" });
    expect(segunda).not.toHaveBeenCalled();
    // Terminada la primera, se puede de nuevo.
    expect(await L.conBloqueoDeImportacion(ANA, "clientes", segunda)).toEqual({ ok: true, valor: 1 });
  });

  it("un candado vencido (una corrida que murió) no traba: se limpia y se toma", async () => {
    B.agregar("fotofficeListActivity", {
      workspaceId: "ws-1", listKey: "importacion", kind: L.TIPO_BLOQUEO, actorLabel: "x", rowCount: 0, query: "",
      createdAt: new Date(Date.now() - L.VIGENCIA_BLOQUEO_MS - 1000),
    });
    expect(await L.conBloqueoDeImportacion(ANA, "clientes", async () => candados().length)).toEqual({ ok: true, valor: 1 });
    expect(candados()).toHaveLength(0);
  });

  it("si la importación lanza, el candado se suelta igual", async () => {
    await expect(L.conBloqueoDeImportacion(ANA, "clientes", async () => { throw new Error("x"); })).rejects.toThrow("x");
    expect(candados()).toHaveLength(0);
  });
});
