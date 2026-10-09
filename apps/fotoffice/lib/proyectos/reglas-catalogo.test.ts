import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const R = await import("./reglas-catalogo");

const regla = (extra: Record<string, unknown> = {}) => ({ circuitId: "ct-1", ownerUserId: null, daysFromEvent: 0, nameTemplate: null, ...extra });
const filas = () => B.datos.fotofficeProductoProyecto;

beforeEach(() => {
  B.vaciar();
  B.agregar("product", { id: "prod-1", workspaceId: "ws-1", name: "Álbum" });
  B.agregar("product", { id: "prod-ajeno", workspaceId: "ws-2", name: "Ajeno" });
  B.agregar("fotofficeCircuit", { id: "ct-1", workspaceId: "ws-1", name: "Álbum", kind: "TRABAJO", isDefault: true });
  B.agregar("fotofficeCircuit", { id: "ct-2", workspaceId: "ws-1", name: "Retoque", kind: "TRABAJO" });
  B.agregar("fotofficeCircuit", { id: "ct-baja", workspaceId: "ws-1", name: "Viejo", kind: "TRABAJO", isActive: false });
  B.agregar("fotofficeCircuit", { id: "cv", workspaceId: "ws-1", name: "Embudo", kind: "VENTA" });
  B.agregar("fotofficeCircuit", { id: "ct-ajeno", workspaceId: "ws-2", name: "Ajeno", kind: "TRABAJO" });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 7, role: "STAFF" });
});

describe("normalizarReglas", () => {
  it("acepta una regla completa y limpia el nombre", () => {
    expect(R.normalizarReglas([regla({ ownerUserId: 7, daysFromEvent: -365, nameTemplate: "  {contacto} · {producto} · {evento} · {pedido}  " })])).toEqual({
      ok: true,
      valor: [{ circuitId: "ct-1", ownerUserId: 7, daysFromEvent: -365, nameTemplate: "{contacto} · {producto} · {evento} · {pedido}" }],
    });
    expect(R.normalizarReglas([regla({ nameTemplate: "   " })])).toMatchObject({ ok: true, valor: [{ nameTemplate: null }] });
    expect(R.normalizarReglas([])).toEqual({ ok: true, valor: [] });
  });

  it("los días van de -365 a 365 y son enteros", () => {
    for (const d of [366, -366, 1.5, "3", NaN, null]) {
      expect(R.normalizarReglas([regla({ daysFromEvent: d })])).toMatchObject({ ok: false, error: expect.stringContaining("-365 y 365") });
    }
    expect(R.normalizarReglas([regla({ daysFromEvent: 365 })]).ok).toBe(true);
  });

  it("pide flujo, no repite flujo y valida responsable y nombre", () => {
    expect(R.normalizarReglas([regla({ circuitId: "" })])).toMatchObject({ ok: false, error: expect.stringContaining("flujo") });
    expect(R.normalizarReglas([regla(), regla()])).toMatchObject({ ok: false, error: expect.stringContaining("otra fila") });
    expect(R.normalizarReglas([regla({ ownerUserId: 0 })]).ok).toBe(false);
    expect(R.normalizarReglas([regla({ ownerUserId: "7" })]).ok).toBe(false);
    expect(R.normalizarReglas([regla({ nameTemplate: "{cliente}" })])).toMatchObject({ ok: false, error: expect.stringContaining("{cliente}") });
    expect(R.normalizarReglas([regla({ nameTemplate: "x".repeat(201) })]).ok).toBe(false);
    expect(R.normalizarReglas(Array.from({ length: 11 }, (_, i) => regla({ circuitId: `c${i}` }))).ok).toBe(false);
  });
});

describe("guardar y leer las reglas de un producto", () => {
  it("guarda varias, en orden, y las lee con el nombre del flujo", async () => {
    expect(await R.guardarReglas("ws-1", "prod-1", [regla({ ownerUserId: 7, daysFromEvent: 30, nameTemplate: "{producto}" }), regla({ circuitId: "ct-2" })])).toEqual({ ok: true });
    expect(filas().map((f) => [f.circuitId, f.order, f.workspaceId])).toEqual([["ct-1", 0, "ws-1"], ["ct-2", 1, "ws-1"]]);
    expect(await R.leerReglas("ws-1", "prod-1")).toEqual([
      expect.objectContaining({ circuitId: "ct-1", circuitName: "Álbum", circuitActive: true, ownerUserId: 7, daysFromEvent: 30, nameTemplate: "{producto}" }),
      expect.objectContaining({ circuitId: "ct-2", circuitName: "Retoque", ownerUserId: null, daysFromEvent: 0, nameTemplate: null }),
    ]);
  });

  it("guardar reemplaza lo anterior y una lista vacía las borra", async () => {
    await R.guardarReglas("ws-1", "prod-1", [regla(), regla({ circuitId: "ct-2" })]);
    await R.guardarReglas("ws-1", "prod-1", [regla({ circuitId: "ct-2", daysFromEvent: 5 })]);
    expect(filas()).toHaveLength(1);
    expect(filas()[0]).toMatchObject({ circuitId: "ct-2", daysFromEvent: 5 });
    await R.guardarReglas("ws-1", "prod-1", []);
    expect(filas()).toHaveLength(0);
  });

  it("sólo flujos de trabajo activos del workspace; uno nuevo dado de baja no vale, uno ya usado se conserva", async () => {
    for (const circuitId of ["cv", "ct-ajeno", "inexistente", "ct-baja"]) {
      expect(await R.guardarReglas("ws-1", "prod-1", [regla({ circuitId })])).toMatchObject({ ok: false, error: expect.stringContaining("Fila 1") });
    }
    expect(filas()).toHaveLength(0);
    B.agregar("fotofficeProductoProyecto", { workspaceId: "ws-1", productId: "prod-1", circuitId: "ct-baja" });
    expect(await R.guardarReglas("ws-1", "prod-1", [regla({ circuitId: "ct-baja", daysFromEvent: 2 })])).toEqual({ ok: true });
    expect(filas()).toHaveLength(1);
    expect((await R.leerReglas("ws-1", "prod-1"))[0]).toMatchObject({ circuitActive: false, daysFromEvent: 2 });
  });

  it("el responsable tiene que ser parte del equipo", async () => {
    expect(await R.guardarReglas("ws-1", "prod-1", [regla({ ownerUserId: 99 })])).toMatchObject({ ok: false, error: expect.stringContaining("equipo") });
    expect(filas()).toHaveLength(0);
  });

  it("un producto de otro workspace no existe y no se toca", async () => {
    expect(await R.guardarReglas("ws-1", "prod-ajeno", [regla()])).toEqual({ ok: false, error: "Ese producto no existe." });
    expect(await R.guardarReglas("ws-1", "nada", [])).toEqual({ ok: false, error: "Ese producto no existe." });
    expect(filas()).toHaveLength(0);
  });

  it("una falla a mitad de camino no deja el producto sin reglas", async () => {
    await R.guardarReglas("ws-1", "prod-1", [regla()]);
    const original = B.tablas.fotofficeProductoProyecto.createMany;
    B.tablas.fotofficeProductoProyecto.createMany = async () => {
      throw new Error("falla");
    };
    try {
      await expect(R.guardarReglas("ws-1", "prod-1", [regla({ circuitId: "ct-2" })])).rejects.toThrow();
    } finally {
      B.tablas.fotofficeProductoProyecto.createMany = original;
    }
    expect(filas().map((f) => f.circuitId)).toEqual(["ct-1"]);
  });

  it("leer: nunca devuelve reglas ni flujos de otro workspace", async () => {
    B.agregar("fotofficeProductoProyecto", { workspaceId: "ws-2", productId: "prod-1", circuitId: "ct-ajeno" });
    expect(await R.leerReglas("ws-1", "prod-1")).toEqual([]);
  });
});

describe("opciones de la sección", () => {
  it("flujos de trabajo activos del workspace (el predeterminado primero) y el equipo", async () => {
    const o = await R.opcionesDeRegla("ws-1");
    expect(o.circuitos).toEqual([{ id: "ct-1", name: "Álbum" }, { id: "ct-2", name: "Retoque" }]);
    expect(o.equipo.map((m) => m.id)).toEqual([7]);
  });
});

describe("permisos de la sección (fuente)", () => {
  it("guardar las reglas exige sales.catalog, igual que los costos", () => {
    const src = readFileSync(join(__dirname, "../../app/(shell)/ventas/catalogo/[productId]/presupuesto-actions.ts"), "utf8");
    const cuerpo = src.slice(src.indexOf("export async function guardarReglasProyectoAction"));
    expect(cuerpo.indexOf("requireSalesAdmin()")).toBeGreaterThan(-1);
    expect(cuerpo.indexOf("requireSalesAdmin()")).toBeLessThan(cuerpo.indexOf("guardarReglas("));
  });
});
