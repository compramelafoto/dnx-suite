import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const C = await import("./contratantes");
const { MENSAJES_CONTRATO: M } = await import("./acceso");

type Nivel = "NONE" | "VIEW" | "MANAGE";
const ctx = (contracts: Nivel, role = "STAFF", clients: Nivel = "VIEW") => ({ workspaceId: "ws-1", userId: 7, userLabel: "Ana", role, acceso: { role, levels: { contracts, clients } } as never });
const GESTIONA = ctx("MANAGE");
const SOLO_VER = ctx("VIEW");
const filas = () => B.datos.fotofficePedidoContratante.map((f) => [f.orden, f.clientId]);

beforeEach(() => {
  B.vaciar();
  B.agregar("client", { id: "c1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Ana", lastName: "Gómez", email: "ana@x.com", phone: "341", docType: "DNI", docNumber: "30", address: "Mitre 1", city: "Rosario" });
  B.agregar("client", { id: "c2", workspaceId: "ws-1", kind: "PERSONA", firstName: "Luis", lastName: "Pérez", email: null });
  B.agregar("client", { id: "c3", workspaceId: "ws-1", kind: "EMPRESA", businessName: "Salón Sol", email: "sol@x.com" });
  B.agregar("client", { id: "c-ajeno", workspaceId: "ws-2", kind: "PERSONA", firstName: "Otra", lastName: "Ajena" });
  B.agregar("fotofficePedido", { id: "p1", workspaceId: "ws-1", number: "P-1", clientId: "c1" });
  B.agregar("fotofficePedido", { id: "p-ajeno", workspaceId: "ws-2", number: "P-1", clientId: "c-ajeno" });
});

describe("contratantes del pedido", () => {
  it("sin filas, el contratante 1 es el contacto del pedido (por omisión) y no hay contratante 2", async () => {
    const r = await C.leerContratantes(SOLO_VER, "p1");
    expect(r).toHaveLength(1);
    expect(r![0]).toMatchObject({ orden: 1, clientId: "c1", nombre: "Gómez, Ana", email: "ana@x.com", porOmision: true });
    expect(r![0].datos).toMatchObject({ nombre: "Gómez, Ana", docType: "DNI", docNumber: "30", address: "Mitre 1", city: "Rosario", phone: "341" });
  });

  it("sin Ver en Contratos no se lee; un pedido ajeno o inexistente es null", async () => {
    expect(await C.leerContratantes(ctx("NONE"), "p1")).toBeNull();
    expect(await C.leerContratantes(GESTIONA, "p-ajeno")).toBeNull();
    expect(await C.leerContratantes(GESTIONA, "nada")).toBeNull();
    expect(await C.leerContratantes(GESTIONA, 5)).toBeNull();
  });

  it("agrega el contratante 2 (puede no tener correo) y cambia el 1", async () => {
    expect(await C.fijarContratante(GESTIONA, { pedidoId: "p1", orden: 2, clientId: "c2" })).toEqual({ ok: true });
    expect(await C.fijarContratante(GESTIONA, { pedidoId: "p1", orden: 1, clientId: "c3" })).toEqual({ ok: true });
    expect(filas()).toEqual([[2, "c2"], [1, "c3"]]);
    const r = (await C.leerContratantes(SOLO_VER, "p1"))!;
    expect(r.map((c) => [c.orden, c.clientId, c.porOmision, c.email])).toEqual([[1, "c3", false, "sol@x.com"], [2, "c2", false, null]]);
    // Cambiar el 2 reemplaza la fila, no suma otra.
    expect(await C.fijarContratante(GESTIONA, { pedidoId: "p1", orden: 2, clientId: "c1" })).toEqual({ ok: true });
    expect(filas()).toEqual([[2, "c1"], [1, "c3"]]);
  });

  it("elegir como contratante 1 al contacto del pedido borra la fila: vuelve a ser por omisión", async () => {
    await C.fijarContratante(GESTIONA, { pedidoId: "p1", orden: 1, clientId: "c3" });
    expect(await C.fijarContratante(GESTIONA, { pedidoId: "p1", orden: 1, clientId: "c1" })).toEqual({ ok: true });
    expect(filas()).toEqual([]);
    expect((await C.leerContratantes(SOLO_VER, "p1"))![0].porOmision).toBe(true);
  });

  it("los dos contratantes no pueden ser la misma persona (tampoco contra el 1 por omisión)", async () => {
    expect(await C.fijarContratante(GESTIONA, { pedidoId: "p1", orden: 2, clientId: "c1" })).toEqual({ ok: false, error: M.contratanteRepetido });
    await C.fijarContratante(GESTIONA, { pedidoId: "p1", orden: 2, clientId: "c2" });
    expect(await C.fijarContratante(GESTIONA, { pedidoId: "p1", orden: 1, clientId: "c2" })).toEqual({ ok: false, error: M.contratanteRepetido });
    expect(filas()).toEqual([[2, "c2"]]);
  });

  it("valida que pedido y contacto sean del workspace, el orden y la forma", async () => {
    expect(await C.fijarContratante(GESTIONA, { pedidoId: "p-ajeno", orden: 2, clientId: "c2" })).toEqual({ ok: false, error: M.pedido });
    expect(await C.fijarContratante(GESTIONA, { pedidoId: "p1", orden: 2, clientId: "c-ajeno" })).toEqual({ ok: false, error: M.contacto });
    expect(await C.fijarContratante(GESTIONA, { pedidoId: "p1", orden: 3, clientId: "c2" })).toEqual({ ok: false, error: M.orden });
    expect(await C.fijarContratante(GESTIONA, { pedidoId: "p1", orden: "2", clientId: "c2" })).toEqual({ ok: false, error: M.orden });
    expect(await C.fijarContratante(GESTIONA, { pedidoId: "", orden: 2, clientId: "c2" })).toEqual({ ok: false, error: M.datosInvalidos });
    expect(await C.fijarContratante(GESTIONA, null)).toEqual({ ok: false, error: M.datosInvalidos });
    expect(filas()).toEqual([]);
  });

  it("escribir exige Gestionar en Contratos", async () => {
    expect(await C.fijarContratante(SOLO_VER, { pedidoId: "p1", orden: 2, clientId: "c2" })).toEqual({ ok: false, error: M.sinPermiso });
    expect(await C.quitarContratante2(SOLO_VER, "p1")).toEqual({ ok: false, error: M.sinPermiso });
  });

  it("fijar un contratante exige además Ver en Clientes (R10), aunque se conozca el id", async () => {
    const sinClientes = ctx("MANAGE", "STAFF", "NONE");
    expect(await C.fijarContratante(sinClientes, { pedidoId: "p1", orden: 2, clientId: "c2" })).toEqual({ ok: false, error: M.buscarClientes });
    expect(filas()).toEqual([]);
    expect(filas()).toEqual([]);
  });

  it("quita al contratante 2; sin contratante 2 avisa", async () => {
    expect(await C.quitarContratante2(GESTIONA, "p1")).toEqual({ ok: false, error: M.sinContratante2 });
    await C.fijarContratante(GESTIONA, { pedidoId: "p1", orden: 2, clientId: "c2" });
    expect(await C.quitarContratante2(GESTIONA, "p1")).toEqual({ ok: true });
    expect(filas()).toEqual([]);
    expect(await C.quitarContratante2(GESTIONA, "p-ajeno")).toEqual({ ok: false, error: M.pedido });
  });
});
