import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  relFind: vi.fn(), relFindMany: vi.fn(), relCreate: vi.fn(), relDeleteMany: vi.fn(),
  clientFind: vi.fn(), clientFindMany: vi.fn(), memberFind: vi.fn(), memberFindMany: vi.fn(),
  evento: vi.fn(), alta: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("./eventos", () => ({ registrarEventoPersona: H.evento }));
vi.mock("@/lib/clients/alta", () => ({ crearClienteConNumero: H.alta }));
vi.mock("@repo/db", () => {
  const prisma = {
    fotofficePersonRelation: {
      findFirst: H.relFind, findMany: H.relFindMany, create: H.relCreate, deleteMany: H.relDeleteMany,
    },
    client: { findFirst: H.clientFind, findMany: H.clientFindMany },
    member: { findFirst: H.memberFind, findMany: H.memberFindMany },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { prisma };
});

const R = await import("./relaciones");

const CTX = { workspaceId: "ws-1", userId: 1, userLabel: "Ana", role: "STAFF" };
const YO = { clientId: "c1", memberId: null };

beforeEach(() => {
  for (const f of Object.values(H)) f.mockReset();
  H.relCreate.mockResolvedValue({ id: "r1" });
  H.clientFind.mockImplementation(async ({ where }: any) =>
    where.id === "c1" ? { id: "c1", memberId: null, firstName: "Ana", lastName: "Gómez", businessName: null }
    : where.id === "c2" ? { id: "c2", memberId: null, firstName: "Luis", lastName: "Paz", businessName: null }
    : null);
  H.memberFind.mockResolvedValue(null);
});

describe("relacionesDePersona", () => {
  const fila = (o: any) => ({
    id: "r1", kind: "madre-padre", customLabel: null, note: null,
    fromClientId: null, fromMemberId: null, toClientId: null, toMemberId: null,
    fromClient: null, toClient: null, fromMember: null, toMember: null, ...o,
  });
  it("la etiqueta describe a la otra: el origen ve 'Hijo o hija' y el destino 'Madre o padre'", async () => {
    H.relFindMany.mockResolvedValue([
      fila({ id: "a", fromClientId: "c1", toClientId: "c2", toClient: { id: "c2", firstName: "Luis", lastName: "Paz", businessName: null }, note: "hijo mayor" }),
      fila({ id: "b", fromMemberId: "m9", toClientId: "c1", fromMember: { id: "m9", firstName: "Rosa", lastName: "Díaz" } }),
    ]);
    const r = await R.relacionesDePersona("ws-1", YO);
    expect(r[0]).toEqual({
      id: "a", otra: { tipo: "CLIENTE", id: "c2", nombre: "Luis Paz", href: "/clientes/c2" }, etiqueta: "Hijo o hija", nota: "hijo mayor",
    });
    expect(r[1]).toMatchObject({ etiqueta: "Madre o padre", otra: { tipo: "SOCIO", id: "m9", nombre: "Rosa Díaz", href: "/members/m9" } });
  });
  it("busca por las dos formas y en los dos sentidos, dentro del workspace", async () => {
    H.relFindMany.mockResolvedValue([]);
    await R.relacionesDePersona("ws-1", { clientId: "c1", memberId: "m1" });
    const where = H.relFindMany.mock.calls[0][0].where;
    expect(where.workspaceId).toBe("ws-1");
    expect(where.OR).toEqual([
      { fromClientId: "c1" }, { fromMemberId: "m1" }, { toClientId: "c1" }, { toMemberId: "m1" },
    ]);
  });
  it("una persona que figura como socio en la fila se reconoce como origen", async () => {
    H.relFindMany.mockResolvedValue([
      fila({ fromMemberId: "m1", toClientId: "c2", toClient: { id: "c2", firstName: "Luis", lastName: null, businessName: null } }),
    ]);
    const r = await R.relacionesDePersona("ws-1", { clientId: "c1", memberId: "m1" });
    expect(r[0].etiqueta).toBe("Hijo o hija");
  });
  it("el vínculo libre muestra el texto escrito", async () => {
    H.relFindMany.mockResolvedValue([
      fila({ kind: "otro", customLabel: "Padrino", fromClientId: "c1", toClientId: "c2", toClient: { id: "c2", firstName: "Luis", lastName: null, businessName: null } }),
    ]);
    expect((await R.relacionesDePersona("ws-1", YO))[0].etiqueta).toBe("Padrino");
  });
});

describe("crearRelacion", () => {
  it("crea la relación y un evento en cada persona", async () => {
    H.relFind.mockResolvedValue(null);
    const r = await R.crearRelacion(CTX, YO, { otra: { clientId: "c2", memberId: null }, clave: "madre-padre", nota: " es el mayor " });
    expect(r).toEqual({ ok: true });
    expect(H.relCreate.mock.calls[0][0].data).toMatchObject({
      workspaceId: "ws-1", fromClientId: "c1", toClientId: "c2", kind: "madre-padre", note: "es el mayor", createdByUserId: 1,
    });
    expect(H.evento).toHaveBeenCalledTimes(2);
    expect(H.evento.mock.calls.map((c) => [c[1].kind, c[1].dueno])).toEqual([
      ["RELACION_CREADA", { clientId: "c1" }], ["RELACION_CREADA", { clientId: "c2" }],
    ]);
  });
  it("repetido en sentido inverso: 'Ya están vinculadas.'", async () => {
    H.relFind.mockResolvedValue({ id: "x" });
    const r = await R.crearRelacion(CTX, YO, { otra: { clientId: "c2", memberId: null }, clave: "pareja" });
    expect(r).toEqual({ ok: false, error: "Ya están vinculadas." });
    expect(H.relCreate).not.toHaveBeenCalled();
    const or = H.relFind.mock.calls[0][0].where.OR;
    expect(or).toHaveLength(2);
    expect(JSON.stringify(or[0])).toContain('"fromClientId":"c1"');
    expect(JSON.stringify(or[0])).toContain('"toClientId":"c2"');
    expect(JSON.stringify(or[1])).toContain('"fromClientId":"c2"');
    expect(JSON.stringify(or[1])).toContain('"toClientId":"c1"');
    expect(H.relFind.mock.calls[0][0].where.workspaceId).toBe("ws-1");
  });
  it("persona de otro workspace: 'No encontramos a esa persona.'", async () => {
    const r = await R.crearRelacion(CTX, YO, { otra: { clientId: "ajeno", memberId: null }, clave: "amigo" });
    expect(r).toEqual({ ok: false, error: "No encontramos a esa persona." });
    expect(H.clientFind.mock.calls.at(-1)![0].where).toMatchObject({ id: "ajeno", workspaceId: "ws-1" });
    expect(H.relCreate).not.toHaveBeenCalled();
  });
  it("no se puede vincular consigo misma", async () => {
    const r = await R.crearRelacion(CTX, YO, { otra: { clientId: "c1", memberId: null }, clave: "amigo" });
    expect(r).toEqual({ ok: false, error: "No podés vincular a una persona consigo misma." });
  });
  it("el mismo socio en su forma de socio también es la misma persona", async () => {
    H.memberFind.mockResolvedValue({ id: "m1", clientLink: { id: "c1" } });
    const r = await R.crearRelacion(CTX, { clientId: "c1", memberId: "m1" }, { otra: { clientId: null, memberId: "m1" }, clave: "amigo" });
    expect(r.ok).toBe(false);
  });
  it("'otro' exige texto de 1 a 40; nota hasta 200; clave conocida", async () => {
    const otra = { clientId: "c2", memberId: null };
    expect((await R.crearRelacion(CTX, YO, { otra, clave: "otro" })).ok).toBe(false);
    expect((await R.crearRelacion(CTX, YO, { otra, clave: "otro", customLabel: "x".repeat(41) })).ok).toBe(false);
    expect((await R.crearRelacion(CTX, YO, { otra, clave: "amigo", nota: "x".repeat(201) })).ok).toBe(false);
    expect((await R.crearRelacion(CTX, YO, { otra, clave: "inventado" })).ok).toBe(false);
    H.relFind.mockResolvedValue(null);
    expect((await R.crearRelacion(CTX, YO, { otra, clave: "otro", customLabel: "Padrino" })).ok).toBe(true);
    expect(H.relCreate.mock.calls[0][0].data).toMatchObject({ kind: "otro", customLabel: "Padrino" });
  });
  it("alta rápida: crea el cliente con número y deja relación y dos eventos en la misma transacción", async () => {
    H.alta.mockImplementation(async (_ws: string, _d: unknown, _a: unknown, dentro: any) => {
      await dentro({ fotofficePersonRelation: { create: H.relCreate } }, "cNuevo");
      return "cNuevo";
    });
    const r = await R.crearRelacion(CTX, YO, {
      otra: { nuevoCliente: { nombre: "  Marta   Ruiz ", telefono: " 341 555 " } }, clave: "hermano",
    });
    expect(r).toEqual({ ok: true });
    expect(H.alta.mock.calls[0][0]).toBe("ws-1");
    expect(H.alta.mock.calls[0][1]).toEqual({ firstName: "Marta Ruiz", phone: "341 555" });
    expect(H.relCreate.mock.calls[0][0].data).toMatchObject({ fromClientId: "c1", toClientId: "cNuevo", kind: "hermano" });
    expect(H.evento.mock.calls.map((c) => c[1].dueno)).toEqual([{ clientId: "c1" }, { clientId: "cNuevo" }]);
  });
  it("desde la ficha de la hija, 'Madre o padre' para la madre guarda from = madre, to = hija", async () => {
    H.relFind.mockResolvedValue(null);
    const HIJA = { clientId: "c2", memberId: null };
    const r = await R.crearRelacion(CTX, HIJA, { otra: { clientId: "c1", memberId: null }, clave: "madre-padre", sentido: "otra-es" });
    expect(r).toEqual({ ok: true });
    expect(H.relCreate.mock.calls[0][0].data).toMatchObject({ fromClientId: "c1", toClientId: "c2", kind: "madre-padre" });
    // Cada historia describe a la otra persona.
    expect(H.evento.mock.calls.map((c) => [c[1].dueno, c[1].detail.etiqueta, c[1].detail.otra])).toEqual([
      [{ clientId: "c2" }, "Madre o padre", "Ana Gómez"],
      [{ clientId: "c1" }, "Hijo o hija", "Luis Paz"],
    ]);

    // Leída desde cada lado: la hija ve a su madre y la madre ve a su hija.
    const fila = {
      id: "r1", kind: "madre-padre", customLabel: null, note: null,
      fromClientId: "c1", fromMemberId: null, toClientId: "c2", toMemberId: null,
      fromClient: { id: "c1", firstName: "Ana", lastName: "Gómez", businessName: null },
      toClient: { id: "c2", firstName: "Luis", lastName: "Paz", businessName: null },
      fromMember: null, toMember: null,
    };
    H.relFindMany.mockResolvedValue([fila]);
    expect((await R.relacionesDePersona("ws-1", HIJA))[0]).toMatchObject({ etiqueta: "Madre o padre", otra: { id: "c1" } });
    expect((await R.relacionesDePersona("ws-1", YO))[0]).toMatchObject({ etiqueta: "Hijo o hija", otra: { id: "c2" } });
  });
  it("desde la ficha de la madre, 'Hijo o hija' para la hija guarda from = madre, to = hija", async () => {
    H.relFind.mockResolvedValue(null);
    const r = await R.crearRelacion(CTX, YO, { otra: { clientId: "c2", memberId: null }, clave: "madre-padre", sentido: "esta-es" });
    expect(r).toEqual({ ok: true });
    expect(H.relCreate.mock.calls[0][0].data).toMatchObject({ fromClientId: "c1", toClientId: "c2" });
    expect(H.evento.mock.calls.map((c) => [c[1].dueno, c[1].detail.etiqueta])).toEqual([
      [{ clientId: "c1" }, "Hijo o hija"],
      [{ clientId: "c2" }, "Madre o padre"],
    ]);
  });
  it("sentido desconocido: no crea nada", async () => {
    const r = await R.crearRelacion(CTX, YO, { otra: { clientId: "c2", memberId: null }, clave: "amigo", sentido: "x" as never });
    expect(r.ok).toBe(false);
    expect(H.relCreate).not.toHaveBeenCalled();
  });
  it("alta rápida con 'otra-es': el cliente nuevo queda como origen", async () => {
    H.alta.mockImplementation(async (_ws: string, _d: unknown, _a: unknown, dentro: any) => {
      await dentro({ fotofficePersonRelation: { create: H.relCreate } }, "cNuevo");
      return "cNuevo";
    });
    const r = await R.crearRelacion(CTX, YO, {
      otra: { nuevoCliente: { nombre: "Rosa", telefono: "" } }, clave: "madre-padre", sentido: "otra-es",
    });
    expect(r).toEqual({ ok: true });
    expect(H.relCreate.mock.calls[0][0].data).toMatchObject({ fromClientId: "cNuevo", toClientId: "c1" });
    expect(H.evento.mock.calls.map((c) => [c[1].dueno, c[1].detail.etiqueta])).toEqual([
      [{ clientId: "c1" }, "Madre o padre"],
      [{ clientId: "cNuevo" }, "Hijo o hija"],
    ]);
  });
  it("alta rápida sin nombre no crea nada", async () => {
    const r = await R.crearRelacion(CTX, YO, { otra: { nuevoCliente: { nombre: " ", telefono: "1" } }, clave: "amigo" });
    expect(r).toEqual({ ok: false, error: "Escribí el nombre de la persona nueva." });
    expect(H.alta).not.toHaveBeenCalled();
  });
});

describe("borrarRelacion", () => {
  it("borra y deja un evento en cada persona", async () => {
    H.relFind.mockResolvedValue({ id: "r1", kind: "madre-padre", customLabel: null, fromClientId: "c1", fromMemberId: null, toClientId: null, toMemberId: "m5" });
    expect(await R.borrarRelacion(CTX, YO, "r1")).toEqual({ ok: true });
    expect(H.relDeleteMany.mock.calls[0][0].where).toEqual({ id: "r1", workspaceId: "ws-1" });
    expect(H.evento.mock.calls.map((c) => [c[1].kind, c[1].dueno, c[1].detail.etiqueta])).toEqual([
      ["RELACION_BORRADA", { clientId: "c1" }, "Hijo o hija"], ["RELACION_BORRADA", { memberId: "m5" }, "Madre o padre"],
    ]);
  });
  it("una relación ajena o de otra persona: no encontrada", async () => {
    H.relFind.mockResolvedValue(null);
    expect(await R.borrarRelacion(CTX, YO, "zzz")).toEqual({ ok: false, error: "No encontramos ese vínculo." });
    expect(H.relFind.mock.calls[0][0].where).toMatchObject({ workspaceId: "ws-1", id: "zzz" });
    expect(H.relDeleteMany).not.toHaveBeenCalled();
  });
});

describe("buscarPersonas", () => {
  it("clientes y socios, hasta 10, un socio con cliente aparece como cliente una vez", async () => {
    H.clientFindMany.mockResolvedValue([{ id: "c2", firstName: "Luis", lastName: "Paz", businessName: null, docNumber: "123", phone: null }]);
    H.memberFindMany.mockResolvedValue([
      { id: "m1", firstName: "Luis", lastName: "Paz", documentNumber: "123", phone: null, clientLink: { id: "c2" } },
      { id: "m2", firstName: "Lucía", lastName: "Paz", documentNumber: null, phone: "341", clientLink: null },
    ]);
    const r = await R.buscarPersonas("ws-1", "paz");
    expect(r.map((p) => [p.tipo, p.id])).toEqual([["CLIENTE", "c2"], ["SOCIO", "m2"]]);
    expect(H.clientFindMany.mock.calls[0][0].where.workspaceId).toBe("ws-1");
    expect(H.memberFindMany.mock.calls[0][0].where.workspaceId).toBe("ws-1");
    expect(H.clientFindMany.mock.calls[0][0].take).toBe(10);
  });
  it("texto vacío no busca", async () => {
    expect(await R.buscarPersonas("ws-1", "  ")).toEqual([]);
    expect(H.clientFindMany).not.toHaveBeenCalled();
  });
});
