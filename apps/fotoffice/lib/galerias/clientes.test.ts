import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({ workspaceId: ws, slug: "dnxestudio", customDomain: null, nombre: "DNX Estudio", logoUrl: null, whatsapp: null, email: null }),
  workspaceDelSlug: async () => "ws-1",
}));

const C = await import("./clientes");
const { MENSAJES_GALERIA: M } = await import("./acceso");
const { tokenDeGaleriaCliente, hashDeToken } = await import("./enlace");
const { MAX_CLIENTES_POR_GALERIA } = await import("./constantes");

type Nivel = "NONE" | "VIEW" | "MANAGE";
const ctx = (gallery: Nivel, workspaceId = "ws-1") => ({ workspaceId, userId: 7, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { gallery } } as never });
const GESTIONA = ctx("MANAGE");
const SOLO_VER = ctx("VIEW");
const OTRO_WS = ctx("MANAGE", "ws-2");
const AHORA = new Date("2026-10-10T15:00:00.123Z");
const CLAVE = "clave-de-prueba";
const DEPS = { ahora: () => AHORA, clave: CLAVE, appOrigin: "https://app.test" };

const clientes = () => B.datos.fotofficeGaleriaCliente;
const eventos = () => B.datos.fotofficeGaleriaEvento.map((e) => e.type);

beforeEach(() => {
  vi.clearAllMocks();
  B.vaciar();
  B.agregar("client", { id: "c1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Ana", lastName: "Gómez", email: "Ana@X.com", phone: "+54 9 341 555-0000" });
  B.agregar("client", { id: "c2", workspaceId: "ws-1", kind: "EMPRESA", businessName: "Foto SA" });
  B.agregar("client", { id: "c-ajeno", workspaceId: "ws-2", kind: "PERSONA", firstName: "Otra", lastName: "Ajena", email: "o@x.com" });
  B.agregar("fotofficeGaleria", { id: "g1", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Boda", status: "PUBLICADA" });
  B.agregar("fotofficeGaleria", { id: "g-borrador", workspaceId: "ws-1", proyectoId: "pr1", number: "G-2", name: "Borrador", status: "BORRADOR" });
  B.agregar("fotofficeGaleria", { id: "g-arch", workspaceId: "ws-1", proyectoId: "pr1", number: "G-3", name: "Archivada", status: "ARCHIVADA" });
  B.agregar("fotofficeGaleria", { id: "g-ajena", workspaceId: "ws-2", proyectoId: "pr9", number: "G-1", name: "Ajena", status: "PUBLICADA" });
});

async function agregar(datos: Record<string, unknown>, galeria = "g1", c = GESTIONA) {
  const r = await C.agregarClienteGaleria(c, galeria, datos, DEPS);
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

describe("agregar", () => {
  it("un contacto del padrón: toma su nombre, correo (en minúsculas) y teléfono, y guarda sólo el hash del token", async () => {
    const id = await agregar({ clientId: "c1" });
    const f = clientes()[0]!;
    expect(f).toMatchObject({ id, workspaceId: "ws-1", galeriaId: "g1", clientId: "c1", name: "Ana Gómez", email: "ana@x.com", phone: "+54 9 341 555-0000", status: "EN_PROGRESO", revokedAt: null });
    expect(f.tokenIssuedAt).toEqual(AHORA);
    expect(f.tokenHash).toBe(hashDeToken(tokenDeGaleriaCliente(id, AHORA, CLAVE)));
    expect(JSON.stringify(f)).not.toContain(tokenDeGaleriaCliente(id, AHORA, CLAVE));
    expect(eventos()).toEqual(["CLIENTE_AGREGADO"]);
  });
  it("un contacto empresa usa la razón social; sin correo ni teléfono igual entra", async () => {
    await agregar({ clientId: "c2" });
    expect(clientes()[0]).toMatchObject({ name: "Foto SA", email: null, phone: null });
  });
  it("alta rápida: nombre y correo o teléfono; valida cada dato", async () => {
    await agregar({ nombre: "  Luis  Pérez ", email: "LUIS@x.com" });
    await agregar({ nombre: "Marta", telefono: "+54 9 341 555-1111" });
    expect(clientes().map((c) => [c.name, c.email, c.phone, c.clientId])).toEqual([
      ["Luis Pérez", "luis@x.com", null, null],
      ["Marta", null, "+54 9 341 555-1111", null],
    ]);
    expect(await C.agregarClienteGaleria(GESTIONA, "g1", { nombre: "", email: "a@x.com" }, DEPS)).toEqual({ ok: false, error: M.nombreCliente });
    expect(await C.agregarClienteGaleria(GESTIONA, "g1", { nombre: "Z" }, DEPS)).toEqual({ ok: false, error: M.sinDatosDeContacto });
    expect(await C.agregarClienteGaleria(GESTIONA, "g1", { nombre: "Z", email: "no" }, DEPS)).toEqual({ ok: false, error: M.correoInvalido });
    expect(await C.agregarClienteGaleria(GESTIONA, "g1", { nombre: "Z", telefono: "abc" }, DEPS)).toEqual({ ok: false, error: M.telefonoInvalido });
    expect(clientes()).toHaveLength(2);
  });
  it("el mismo contacto no entra dos veces, pero dos altas rápidas iguales sí (son personas distintas)", async () => {
    await agregar({ clientId: "c1" });
    expect(await C.agregarClienteGaleria(GESTIONA, "g1", { clientId: "c1" }, DEPS)).toEqual({ ok: false, error: M.contactoRepetido });
    await agregar({ nombre: "Luis", email: "l@x.com" });
    await agregar({ nombre: "Luis", email: "l@x.com" });
    expect(clientes()).toHaveLength(3);
    // En otra galería el mismo contacto sí puede estar.
    B.agregar("fotofficeGaleria", { id: "g2", workspaceId: "ws-1", proyectoId: "pr1", number: "G-4", name: "Otra", status: "BORRADOR" });
    await agregar({ clientId: "c1" }, "g2");
  });
  it("tope de 30 clientes por galería", async () => {
    for (let i = 0; i < MAX_CLIENTES_POR_GALERIA; i++) await agregar({ nombre: `N${i}`, email: `n${i}@x.com` });
    expect(await C.agregarClienteGaleria(GESTIONA, "g1", { nombre: "31", email: "x@x.com" }, DEPS)).toEqual({ ok: false, error: M.topeClientes });
    expect(clientes()).toHaveLength(30);
    // El tope es por galería.
    await agregar({ nombre: "Otro", email: "o@x.com" }, "g-borrador");
  });
  it("aislamiento: contacto o galería de otro workspace no existen; sin Gestionar no", async () => {
    expect(await C.agregarClienteGaleria(GESTIONA, "g1", { clientId: "c-ajeno" }, DEPS)).toEqual({ ok: false, error: M.contacto });
    expect(await C.agregarClienteGaleria(GESTIONA, "g-ajena", { nombre: "A", email: "a@x.com" }, DEPS)).toEqual({ ok: false, error: M.noExiste });
    expect(await C.agregarClienteGaleria(OTRO_WS, "g1", { nombre: "A", email: "a@x.com" }, DEPS)).toEqual({ ok: false, error: M.noExiste });
    expect(await C.agregarClienteGaleria(SOLO_VER, "g1", { nombre: "A", email: "a@x.com" }, DEPS)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await C.agregarClienteGaleria(GESTIONA, "g1", null, DEPS)).toEqual({ ok: false, error: M.datosInvalidos });
    expect(await C.agregarClienteGaleria(GESTIONA, "g1", { nombre: "A", email: "a@x.com" }, { ...DEPS, clave: null })).toEqual({ ok: false, error: M.sinClaveEnlace });
    expect(clientes()).toHaveLength(0);
  });
});

describe("listar", () => {
  it("lee sólo con Ver y sólo del workspace propio", async () => {
    // _count no está emulado en la base en memoria: se prueba la guarda, no el conteo.
    expect(await C.listarClientesDeGaleria(OTRO_WS, "g1")).toEqual([]);
    expect(await C.listarClientesDeGaleria(ctx("NONE"), "g1")).toEqual([]);
    expect(await C.listarClientesDeGaleria(SOLO_VER, "no valido!")).toEqual([]);
  });
});

describe("compartir el enlace", () => {
  it("copiar: devuelve la dirección con el token vigente y deja evento", async () => {
    const id = await agregar({ clientId: "c1" });
    const r = await C.enlaceDeCliente(GESTIONA, id, DEPS);
    const token = tokenDeGaleriaCliente(id, AHORA, CLAVE);
    expect(r).toEqual({ ok: true, url: `https://app.test/w/dnxestudio/galeria/${token}` });
    expect(eventos()).toContain("ENLACE_COPIADO");
  });
  it("borrador y archivada: no se comparte, con un mensaje claro", async () => {
    const b = await agregar({ nombre: "A", email: "a@x.com" }, "g-borrador");
    const a = await agregar({ nombre: "B", email: "b@x.com" }, "g-arch");
    expect(await C.enlaceDeCliente(GESTIONA, b, DEPS)).toEqual({ ok: false, error: M.publicarPrimero });
    expect(await C.whatsappDeCliente(GESTIONA, b, DEPS)).toEqual({ ok: false, error: M.publicarPrimero });
    expect(await C.pedirEnvioPorCorreo(GESTIONA, b, DEPS)).toEqual({ ok: false, error: M.publicarPrimero });
    expect(await C.enlaceDeCliente(GESTIONA, a, DEPS)).toEqual({ ok: false, error: M.galeriaArchivada });
  });
  it("anulado: no se comparte", async () => {
    const id = await agregar({ clientId: "c1" });
    await C.anularEnlace(GESTIONA, id, AHORA);
    expect(await C.enlaceDeCliente(GESTIONA, id, DEPS)).toEqual({ ok: false, error: M.clienteAnulado });
    expect(await C.pedirEnvioPorCorreo(GESTIONA, id, DEPS)).toEqual({ ok: false, error: M.clienteAnulado });
  });
  it("si la clave de enlaces cambió (el token ya no coincide con el hash), no entrega un enlace muerto", async () => {
    const id = await agregar({ clientId: "c1" });
    expect(await C.enlaceDeCliente(GESTIONA, id, { ...DEPS, clave: "otra-clave" })).toEqual({ ok: false, error: M.sinClaveEnlace });
  });
  it("WhatsApp: arma wa.me con el texto y el enlace; sin teléfono, avisa", async () => {
    const con = await agregar({ clientId: "c1" });
    const sin = await agregar({ nombre: "Sin Tel", email: "s@x.com" });
    const r = await C.whatsappDeCliente(GESTIONA, con, DEPS);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.url).toMatch(/^https:\/\/wa\.me\/549341/);
      expect(decodeURIComponent(r.url)).toContain(`/w/dnxestudio/galeria/${tokenDeGaleriaCliente(con, AHORA, CLAVE)}`);
      expect(decodeURIComponent(r.url)).toContain("Hola Ana");
    }
    expect(await C.whatsappDeCliente(GESTIONA, sin, DEPS)).toEqual({ ok: false, error: M.sinTelefono });
    // Un teléfono sin código de país no se completa adivinando: avisa qué falta.
    const local = await agregar({ nombre: "Local", telefono: "341 555 2222" });
    expect(await C.whatsappDeCliente(GESTIONA, local, DEPS)).toEqual({ ok: false, error: M.sinTelefono });
    expect(M.sinTelefono).toContain("código de país");
    expect(eventos().filter((e) => e === "ENLACE_WHATSAPP")).toHaveLength(1);
  });
  it("correo: pide el envío sólo si tiene correo; deja el pedido en el historial", async () => {
    const con = await agregar({ clientId: "c1" });
    const sin = await agregar({ nombre: "Sin Correo", telefono: "+54 9 341 555 2222" });
    expect(await C.pedirEnvioPorCorreo(GESTIONA, con, DEPS)).toEqual({ ok: true, galeriaId: "g1", clienteId: con });
    expect(await C.pedirEnvioPorCorreo(GESTIONA, sin, DEPS)).toEqual({ ok: false, error: M.sinCorreo });
    expect(eventos().filter((e) => e === "CORREO_PEDIDO")).toHaveLength(1);
  });
  it("aislamiento y permisos en copiar, WhatsApp y correo", async () => {
    const id = await agregar({ clientId: "c1" });
    for (const f of [C.enlaceDeCliente, C.whatsappDeCliente, C.pedirEnvioPorCorreo]) {
      expect(await f(OTRO_WS, id, DEPS)).toEqual({ ok: false, error: M.clienteNoExiste });
      expect(await f(SOLO_VER, id, DEPS)).toEqual({ ok: false, error: M.sinPermiso });
      expect((await f(GESTIONA, "x'; DROP", DEPS)).ok).toBe(false);
    }
  });
});

describe("regenerar y anular", () => {
  it("regenerar cambia el token: el hash viejo ya no está, el nuevo sí, y deja evento", async () => {
    const id = await agregar({ clientId: "c1" });
    const viejo = clientes()[0]!.tokenHash;
    const ahora2 = new Date(AHORA.getTime() + 60_000);
    expect(await C.regenerarEnlace(GESTIONA, id, { ...DEPS, ahora: () => ahora2 })).toEqual({ ok: true });
    const f = clientes()[0]!;
    expect(f.tokenHash).not.toBe(viejo);
    expect(f.tokenHash).toBe(hashDeToken(tokenDeGaleriaCliente(id, ahora2, CLAVE)));
    expect(f.tokenIssuedAt).toEqual(ahora2);
    expect(clientes().some((c) => c.tokenHash === viejo)).toBe(false);
    expect(eventos()).toContain("ENLACE_REGENERADO");
    // El enlace que se entrega ahora es el nuevo.
    const r = await C.enlaceDeCliente(GESTIONA, id, DEPS);
    expect(r.ok && r.url.endsWith(tokenDeGaleriaCliente(id, ahora2, CLAVE))).toBe(true);
  });
  it("regenerar en el mismo instante igual da un token distinto", async () => {
    const id = await agregar({ clientId: "c1" });
    const viejo = clientes()[0]!.tokenHash;
    await C.regenerarEnlace(GESTIONA, id, DEPS);
    expect(clientes()[0]!.tokenHash).not.toBe(viejo);
  });
  it("regenerar un enlace anulado lo habilita de nuevo", async () => {
    const id = await agregar({ clientId: "c1" });
    await C.anularEnlace(GESTIONA, id, AHORA);
    expect(clientes()[0]!.revokedAt).toEqual(AHORA);
    await C.regenerarEnlace(GESTIONA, id, { ...DEPS, ahora: () => new Date(AHORA.getTime() + 1000) });
    expect(clientes()[0]!.revokedAt).toBeNull();
  });
  it("anular marca la fecha una sola vez, conserva el estado y la selección, y deja un evento", async () => {
    const id = await agregar({ clientId: "c1" });
    B.agregar("fotofficeGaleriaSeleccion", { workspaceId: "ws-1", galeriaClienteId: id, fotoId: "f1" });
    clientes()[0]!.status = "EN_REVISION";
    expect(await C.anularEnlace(GESTIONA, id, AHORA)).toEqual({ ok: true });
    expect(await C.anularEnlace(GESTIONA, id, new Date(AHORA.getTime() + 5000))).toEqual({ ok: true });
    expect(clientes()[0]).toMatchObject({ revokedAt: AHORA, status: "EN_REVISION" });
    expect(B.datos.fotofficeGaleriaSeleccion).toHaveLength(1);
    expect(eventos().filter((e) => e === "ENLACE_ANULADO")).toHaveLength(1);
  });
  it("una carrera al regenerar (otro cambió el token) no pisa nada", async () => {
    const id = await agregar({ clientId: "c1" });
    const original = B.tablas.fotofficeGaleriaCliente.updateMany;
    B.tablas.fotofficeGaleriaCliente.updateMany = async (a) => {
      clientes()[0]!.tokenHash = "otro-hash-que-puso-otra-persona";
      return original(a);
    };
    const r = await C.regenerarEnlace(GESTIONA, id, DEPS);
    B.tablas.fotofficeGaleriaCliente.updateMany = original;
    expect(r).toEqual({ ok: false, error: M.carrera });
    expect(clientes()[0]!.tokenHash).toBe("otro-hash-que-puso-otra-persona");
  });
  it("aislamiento y permisos", async () => {
    const id = await agregar({ clientId: "c1" });
    expect(await C.regenerarEnlace(OTRO_WS, id, DEPS)).toEqual({ ok: false, error: M.clienteNoExiste });
    expect(await C.anularEnlace(OTRO_WS, id)).toEqual({ ok: false, error: M.clienteNoExiste });
    expect(await C.regenerarEnlace(SOLO_VER, id, DEPS)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await C.anularEnlace(SOLO_VER, id)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await C.regenerarEnlace(GESTIONA, id, { ...DEPS, clave: null })).toEqual({ ok: false, error: M.sinClaveEnlace });
    expect(clientes()[0]!.revokedAt).toBeNull();
  });
});
