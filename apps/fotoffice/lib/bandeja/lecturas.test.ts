import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

import type { FiltroBandeja } from "./lecturas";
const L = await import("./lecturas");

const AHORA = new Date("2026-10-09T15:00:00.000Z");
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);

const ctxDe = (userId: number, levels: Record<string, "VIEW" | "MANAGE" | "NONE">, workspaceId = "w1") => ({
  workspaceId, userId, userLabel: "x", role: "STAFF", acceso: { role: "STAFF", levels } as never,
});
const ANA = ctxDe(2, { "whatsapp-inbox": "MANAGE", clients: "MANAGE", "service-leads": "VIEW", quotes: "VIEW" });
const LEO = ctxDe(3, { "whatsapp-inbox": "VIEW" });
const SIN = ctxDe(4, {});
const OTRA = ctxDe(2, { "whatsapp-inbox": "MANAGE", clients: "MANAGE" }, "w2");

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la base en memoria tipa el cliente como mapa suelto
const P = B.prisma as Record<string, any>;

async function chat(waId: string, p: Record<string, unknown> = {}) {
  return (await P.fotofficeWaChat.create({ data: { workspaceId: "w1", waId, ultimoMensajeEn: hace(1), ...p } })) as { id: string };
}
async function msg(chatId: string, p: Record<string, unknown> = {}) {
  return P.fotofficeWaMensaje.create({
    data: { workspaceId: "w1", chatId, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "TEXTO", texto: "hola", createdAt: hace(1), ...p },
  });
}

beforeEach(() => {
  B.vaciar();
  B.agregar("user", { id: 2, name: "Ana", email: "ana@x.com" });
  B.agregar("user", { id: 3, name: null, email: "leo@x.com" });
});

describe("listarChats", () => {
  it("sin permiso de Ver devuelve null; con Ver, la lista", async () => {
    await chat("5491111111111");
    expect(await L.listarChats(SIN, { ahora: AHORA })).toBeNull();
    expect(await L.listarChats(LEO, { ahora: AHORA })).toHaveLength(1);
  });

  it("no mezcla instituciones", async () => {
    await chat("5491111111111");
    await P.fotofficeWaChat.create({ data: { workspaceId: "w2", waId: "5492222222222", ultimoMensajeEn: hace(1) } });
    expect(await L.listarChats(OTRA, { ahora: AHORA })).toMatchObject([{ waId: "5492222222222" }]);
    expect((await L.listarChats(ANA, { ahora: AHORA }))?.map((c) => c.waId)).toEqual(["5491111111111"]);
  });

  it("ordena por último mensaje, con vista previa corta, no leídos y asignado", async () => {
    const a = await chat("5491111111111", { ultimoMensajeEn: hace(5), noLeidos: 3, ultimoMensajeTexto: "x".repeat(120), ultimoMensajeTipo: "TEXTO" });
    const b = await chat("5492222222222", { ultimoMensajeEn: hace(1), estado: "HUMANO", asignadoUserId: 2, nombre: "Lu", ultimoMensajeTexto: null, ultimoMensajeTipo: "IMAGEN" });
    const lista = (await L.listarChats(ANA, { ahora: AHORA }))!;
    expect(lista.map((c) => c.id)).toEqual([b.id, a.id]);
    expect(lista[0]).toMatchObject({ titulo: "Lu", asignadoNombre: "Ana", ultimoMensaje: "[Imagen]", atiendeElBot: false });
    expect(lista[1].ultimoMensaje).toHaveLength(120);
    expect(lista[1].noLeidos).toBe(3);
  });

  it("filtros: bot, míos, sin asignar y resueltos", async () => {
    const bot = await chat("5490000000001", { estado: "BOT" });
    const mio = await chat("5490000000002", { estado: "HUMANO", asignadoUserId: 2 });
    const ajeno = await chat("5490000000003", { estado: "HUMANO", asignadoUserId: 3 });
    const pausado = await chat("5490000000004", { estado: "HUMANO", botPausadoHasta: hace(1) });
    const pausaVigente = await chat("5490000000005", { estado: "HUMANO", botPausadoHasta: new Date(AHORA.getTime() + 3_600_000) });
    const resuelto = await chat("5490000000006", { estado: "RESUELTO" });
    const ids = async (filtro: FiltroBandeja) => (await L.listarChats(ANA, { filtro, ahora: AHORA }))!.map((c) => c.id).sort();
    expect(await ids("todos")).toHaveLength(5);
    expect(await ids("todos")).not.toContain(resuelto.id);
    expect(await ids("bot")).toEqual([bot.id, pausado.id].sort());
    expect(await ids("mios")).toEqual([mio.id]);
    expect(await ids("sin-asignar")).toEqual([bot.id, pausado.id, pausaVigente.id].sort());
    expect(await ids("resueltos")).toEqual([resuelto.id]);
    expect(ajeno.id).toBeTruthy();
  });

  it("la lista no consulta los mensajes: la vista previa sale del propio chat", async () => {
    const c = await chat("5491111111111", { ultimoMensajeTexto: "del chat", ultimoMensajeTipo: "TEXTO" });
    await msg(c.id, { texto: "otro texto en la tabla de mensajes" });
    const espia = vi.spyOn(B.tablas.fotofficeWaMensaje, "findFirst");
    const espia2 = vi.spyOn(B.tablas.fotofficeWaMensaje, "findMany");
    expect((await L.listarChats(ANA, { ahora: AHORA }))![0].ultimoMensaje).toBe("del chat");
    expect(espia).not.toHaveBeenCalled();
    expect(espia2).not.toHaveBeenCalled();
    const sin = await chat("5492222222222");
    expect((await L.listarChats(ANA, { ahora: AHORA }))!.find((x) => x.id === sin.id)!.ultimoMensaje).toBeNull();
  });

  it("sin permiso de Clientes la búsqueda no entra a los nombres de las fichas", async () => {
    B.agregar("client", { id: "c1", workspaceId: "w1", kind: "PERSONA", firstName: "Marta", lastName: "Pérez" });
    const conFicha = await chat("5493410000002", { clientId: "c1", nombre: "Marti" });
    await chat("5493410000003", { nombre: "Otro" });
    const ids = async (ctx: typeof ANA, q: string) => (await L.listarChats(ctx, { q, ahora: AHORA }))!.map((c) => c.id);
    expect(await ids(ANA, "pérez")).toEqual([conFicha.id]);
    expect(await ids(LEO, "pérez")).toEqual([]);
    expect(await ids(LEO, "marti")).toEqual([conFicha.id]);
  });

  it("un filtro inventado se trata como todos", async () => {
    await chat("5490000000001");
    expect(await L.listarChats(ANA, { filtro: "hack" as never, ahora: AHORA })).toHaveLength(1);
  });

  it("busca por nombre del perfil, por número y por nombre del cliente", async () => {
    B.agregar("client", { id: "c1", workspaceId: "w1", kind: "PERSONA", firstName: "Marta", lastName: "Pérez" });
    B.agregar("client", { id: "c-otro", workspaceId: "w2", kind: "PERSONA", firstName: "Marta", lastName: "Gómez" });
    const x = await chat("5493410000001", { nombre: "Julieta" });
    const y = await chat("5493410000002", { clientId: "c1" });
    await chat("5493410000003", { nombre: "Otro" });
    const buscar = async (q: string) => (await L.listarChats(ANA, { q, ahora: AHORA }))!.map((c) => c.id);
    expect(await buscar("julie")).toEqual([x.id]);
    expect(await buscar("341 0000002")).toEqual([y.id]);
    expect(await buscar("pérez")).toEqual([y.id]);
    expect(await buscar("zzz")).toEqual([]);
  });

  it("muestra el nombre del cliente sólo con permiso de Clientes", async () => {
    B.agregar("client", { id: "c1", workspaceId: "w1", kind: "PERSONA", firstName: "Marta", lastName: "Pérez" });
    await chat("5493410000002", { clientId: "c1", nombre: "Marti" });
    expect((await L.listarChats(ANA, { ahora: AHORA }))![0]).toMatchObject({ titulo: "Pérez, Marta", clienteNombre: "Pérez, Marta" });
    expect((await L.listarChats(LEO, { ahora: AHORA }))![0]).toMatchObject({ titulo: "Marti", clienteNombre: null });
  });

  it("devuelve como mucho 200 chats", async () => {
    for (let i = 0; i < 205; i++) await chat(`549${String(i).padStart(10, "0")}`);
    expect(await L.listarChats(ANA, { ahora: AHORA })).toHaveLength(200);
  });
});

describe("detalleChat", () => {
  it("sin permiso o de otra institución devuelve null", async () => {
    const c = await chat("5491111111111");
    expect(await L.detalleChat(SIN, c.id, AHORA)).toBeNull();
    expect(await L.detalleChat(OTRA, c.id, AHORA)).toBeNull();
    expect(await L.detalleChat(ANA, "../x", AHORA)).toBeNull();
    expect(await L.detalleChat(ANA, "no-existe", AHORA)).toBeNull();
  });

  it("trae los últimos 200 mensajes en orden, con el estado visible y sin datos internos", async () => {
    const c = await chat("5491111111111", { ultimoEntranteEn: hace(2) });
    for (let i = 0; i < 205; i++) await msg(c.id, { texto: `m${i}`, createdAt: new Date(AHORA.getTime() - (300 - i) * 60_000) });
    await msg(c.id, {
      direccion: "SALIENTE", autor: "USUARIO", texto: "pendiente", estadoEnvio: "PENDIENTE", clientToken: "secreto",
      media: { id: "m" }, createdAt: hace(0.5),
    });
    const d = (await L.detalleChat(ANA, c.id, AHORA))!;
    expect(d.mensajes).toHaveLength(200);
    expect(d.mensajes[0].texto).toBe("m6");
    const ultimo = d.mensajes[199];
    expect(ultimo).toMatchObject({ texto: "pendiente", estadoEnvio: "INCIERTO" });
    expect(Object.keys(ultimo)).not.toContain("clientToken");
    expect(Object.keys(ultimo)).not.toContain("media");
    expect(d.dentroDeVentana).toBe(true);
  });

  it("fuera de las 24 h no se puede responder libre", async () => {
    const c = await chat("5491111111111", { ultimoEntranteEn: hace(30) });
    expect((await L.detalleChat(ANA, c.id, AHORA))!.dentroDeVentana).toBe(false);
  });

  it("resumen del cliente: nombre, ficha y cantidades según permisos", async () => {
    B.agregar("client", { id: "c1", workspaceId: "w1", kind: "PERSONA", firstName: "Marta", lastName: "Pérez" });
    const c = await chat("5491111111111", { clientId: "c1", estado: "HUMANO", asignadoUserId: 3 });
    const d = (await L.detalleChat(ANA, c.id, AHORA))!;
    expect(d.cliente).toMatchObject({ id: "c1", nombre: "Pérez, Marta", href: "/clientes/c1", consultas: 0, presupuestos: 0 });
    expect(d.asignadoNombre).toBe("leo@x.com");
    const sinClientes = (await L.detalleChat(LEO, c.id, AHORA))!;
    expect(sinClientes.cliente).toBeNull();
    expect(sinClientes.clienteOculto).toBe(true);
  });

  it("ignora un cliente de otra institución", async () => {
    B.agregar("client", { id: "c-w2", workspaceId: "w2", kind: "PERSONA", firstName: "Ajena" });
    const c = await chat("5491111111111", { clientId: "c-w2" });
    const d = (await L.detalleChat(ANA, c.id, AHORA))!;
    expect(d.cliente).toBeNull();
  });
});

describe("noLeidosDelWorkspace", () => {
  it("con filas devuelve la suma y sin filas 0", async () => {
    expect(await L.noLeidosDelWorkspace("w1")).toBe(0);
    await chat("5490000000001", { noLeidos: 4 });
    expect(await L.noLeidosDelWorkspace("w1")).toBe(4);
  });

  it("si la lectura falla (tabla sin migrar) devuelve 0", async () => {
    const espia = vi.spyOn(B.tablas.fotofficeWaChat, "aggregate").mockRejectedValueOnce(new Error("relation does not exist"));
    expect(await L.noLeidosDelWorkspace("w1")).toBe(0);
    espia.mockRestore();
  });

  it("usa una sola consulta agregada", async () => {
    await chat("5490000000001", { noLeidos: 2 });
    const a = vi.spyOn(B.tablas.fotofficeWaChat, "aggregate");
    const f = vi.spyOn(B.tablas.fotofficeWaChat, "findMany");
    await L.totalNoLeidos(LEO);
    expect(a).toHaveBeenCalledTimes(1);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("totalNoLeidos", () => {
  it("suma los no leídos del workspace; sin permiso, null", async () => {
    await chat("5490000000001", { noLeidos: 2 });
    await chat("5490000000002", { noLeidos: 3 });
    await chat("5490000000003", { noLeidos: 0 });
    await P.fotofficeWaChat.create({ data: { workspaceId: "w2", waId: "5499999999999", ultimoMensajeEn: hace(1), noLeidos: 9 } });
    expect(await L.totalNoLeidos(LEO)).toBe(5);
    expect(await L.totalNoLeidos(SIN)).toBeNull();
    expect(await L.totalNoLeidos(OTRA)).toBe(9);
  });
});

describe("buscarClientes", () => {
  it("pide Gestionar en la Bandeja y Ver en Clientes, busca sólo en el workspace", async () => {
    B.agregar("client", { id: "c1", workspaceId: "w1", kind: "PERSONA", firstName: "Marta", lastName: "Pérez", phone: "3415551234" });
    B.agregar("client", { id: "c2", workspaceId: "w2", kind: "PERSONA", firstName: "Marta", lastName: "Otra" });
    expect(await L.buscarClientes(LEO, "marta")).toBeNull();
    expect(await L.buscarClientes(ANA, "m")).toEqual([]);
    expect(await L.buscarClientes(ANA, "marta")).toEqual([{ id: "c1", nombre: "Pérez, Marta", telefono: "3415551234" }]);
    expect(await L.buscarClientes(ANA, "341 555")).toHaveLength(1);
    expect(await L.buscarClientes(ctxDe(5, { "whatsapp-inbox": "MANAGE" }), "marta")).toBeNull();
  });
});

describe("vista previa", () => {
  it("se arma con hasta 120 caracteres y el tipo, y la lista usa el tipo si no hay texto", async () => {
    const { vistaPreviaDe, textoDeVistaPrevia } = await import("./vista-previa");
    expect(vistaPreviaDe("a".repeat(500), "TEXTO").ultimoMensajeTexto).toHaveLength(120);
    expect(vistaPreviaDe("  ", "AUDIO")).toEqual({ ultimoMensajeTexto: null, ultimoMensajeTipo: "AUDIO" });
    expect(textoDeVistaPrevia({ ultimoMensajeTexto: null, ultimoMensajeTipo: "AUDIO" })).toBe("[Audio]");
    expect(textoDeVistaPrevia({ ultimoMensajeTexto: null, ultimoMensajeTipo: "XYZ" })).toBe("[Mensaje]");
    expect(textoDeVistaPrevia({ ultimoMensajeTexto: null, ultimoMensajeTipo: null })).toBeNull();
  });
});
