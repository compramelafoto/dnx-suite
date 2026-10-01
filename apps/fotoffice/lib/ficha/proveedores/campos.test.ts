import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
const H = vi.hoisted(() => ({ encendidos: new Set<string>() }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: async (_ws: string, clave: string) => H.encendidos.has(clave) }));

const { proveedorCampos } = await import("./campos");
const { CLIENTS_MODULE_KEY } = await import("@/lib/clients/constants");
const { MEMBERS_MODULE_KEY } = await import("@/lib/members/constants");
const { armarLinea } = await import("../linea-de-tiempo");

const T = (min: number) => new Date(Date.UTC(2026, 9, 1, 12, min));
const WS = { workspaceId: "ws-1" };

function cambio(id: string, extra: Record<string, unknown>) {
  B.agregar("fotofficeCustomValueChange", { id, workspaceId: "ws-1", fieldId: "f-dni", before: null, after: "1", ...extra });
}

beforeEach(() => {
  H.encendidos = new Set([CLIENTS_MODULE_KEY, MEMBERS_MODULE_KEY]);
  B.vaciar();
  B.agregar("fotofficeCustomField", { id: "f-dni", workspaceId: "ws-1", entityType: "CLIENTE", key: "dni", name: "DNI", type: "TEXTO" });
  B.agregar("fotofficeCustomField", { id: "f-cat", workspaceId: "ws-1", entityType: "SOCIO", key: "cat", name: "Categoría vieja", type: "TEXTO" });
  B.agregar("fotofficeCustomField", { id: "f-ajeno", workspaceId: "ws-2", entityType: "CLIENTE", key: "x", name: "Secreto", type: "TEXTO" });
  cambio("a1", { entityType: "CLIENTE", entityId: "c1", before: null, after: "30111222", actorLabel: "Ana", createdAt: T(1) });
  cambio("a2", { entityType: "SOCIO", entityId: "m1", fieldId: "f-cat", before: "Activo", after: null, createdAt: T(2) });
  // Ruido: otra persona, otro tipo con el mismo id, otro workspace con el mismo id.
  cambio("b1", { entityType: "CLIENTE", entityId: "c2", createdAt: T(3) });
  cambio("b2", { entityType: "SOCIO", entityId: "c1", createdAt: T(4) });
  cambio("b3", { workspaceId: "ws-2", entityType: "CLIENTE", entityId: "c1", fieldId: "f-ajeno", after: "secreto", createdAt: T(5) });
  cambio("b4", { entityType: "CONSULTA", entityId: "c1", createdAt: T(6) });
});

describe("proveedor campos — cambios de «Más datos» en la línea de tiempo", () => {
  it("es de tipo cambios", () => {
    expect(proveedorCampos.clave).toBe("campos");
    expect(proveedorCampos.tipo).toBe("cambios");
  });

  it("sólo los del cliente y del socio de la persona, en su workspace", async () => {
    const ev = await proveedorCampos.traer(WS, { clientId: "c1", memberId: "m1" }, null, 10);
    expect(ev.map((e) => e.id)).toEqual(["campos:a2", "campos:a1"]);
    expect(ev[1]).toMatchObject({
      tipo: "cambios",
      actor: "Ana",
      titulo: "Más datos modificados",
      cambios: [{ campo: "DNI", antes: "vacío", despues: "30111222" }],
    });
    expect(ev[0]!.cambios).toEqual([{ campo: "Categoría vieja", antes: "Activo", despues: "vacío" }]);
    expect(JSON.stringify(ev)).not.toContain("secreto");
  });

  it("sólo cliente o sólo socio: lee el lado que hay", async () => {
    expect((await proveedorCampos.traer(WS, { clientId: "c1", memberId: null }, null, 10)).map((e) => e.id)).toEqual(["campos:a1"]);
    expect((await proveedorCampos.traer(WS, { clientId: null, memberId: "m1" }, null, 10)).map((e) => e.id)).toEqual(["campos:a2"]);
    expect(await proveedorCampos.traer(WS, { clientId: null, memberId: null }, null, 10)).toEqual([]);
  });

  it("cada lado sólo con su módulo encendido, como «Más datos» en la ficha", async () => {
    const persona = { clientId: "c1", memberId: "m1" };
    H.encendidos = new Set([CLIENTS_MODULE_KEY]);
    expect((await proveedorCampos.traer(WS, persona, null, 10)).map((e) => e.id)).toEqual(["campos:a1"]);
    H.encendidos = new Set([MEMBERS_MODULE_KEY]);
    expect((await proveedorCampos.traer(WS, persona, null, 10)).map((e) => e.id)).toEqual(["campos:a2"]);
    H.encendidos = new Set();
    expect(await proveedorCampos.traer(WS, persona, null, 10)).toEqual([]);
  });

  it("otro workspace no ve nada aunque coincidan los ids", async () => {
    const ev = await proveedorCampos.traer({ workspaceId: "ws-3" }, { clientId: "c1", memberId: "m1" }, null, 10);
    expect(ev).toEqual([]);
  });

  it("el nombre de un campo de otro workspace nunca se usa", async () => {
    cambio("a3", { entityType: "CLIENTE", entityId: "c1", fieldId: "f-ajeno", createdAt: T(7) });
    const ev = await proveedorCampos.traer(WS, { clientId: "c1", memberId: null }, null, 10);
    expect(ev[0]!.cambios![0]!.campo).toBe("Campo borrado");
  });

  it("pagina con el cursor de la línea sin repetir ni perder filas de la misma fecha", async () => {
    cambio("a4", { entityType: "CLIENTE", entityId: "c1", createdAt: T(10) });
    cambio("a5", { entityType: "CLIENTE", entityId: "c1", createdAt: T(10) });
    cambio("a6", { entityType: "CLIENTE", entityId: "c1", createdAt: T(10) });
    const persona = { clientId: "c1", memberId: "m1" };
    const ctx = { workspaceId: "ws-1", role: "STAFF" };
    const vistos: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 10; i++) {
      const p = await armarLinea({ proveedores: [proveedorCampos], ctx, persona, filtro: null, cursor, take: 2 });
      vistos.push(...p.eventos.map((e) => e.id));
      cursor = p.siguiente;
      if (!cursor) break;
    }
    expect(vistos).toEqual(["campos:a6", "campos:a5", "campos:a4", "campos:a2", "campos:a1"]);
  });
});
