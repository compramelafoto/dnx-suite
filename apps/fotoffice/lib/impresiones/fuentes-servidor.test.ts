import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  fotofficeProyecto: { findFirst: vi.fn() },
  fotofficeArchivoTrabajo: { findMany: vi.fn() },
  client: { findFirst: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/presupuestos/enlace", () => ({ hashDeToken: (t: string) => `h:${t}` }));
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ bucketR2Privado: () => "b", clienteR2Privado: () => ({ send: vi.fn() }) }));
vi.mock("@/lib/carpetas/subir-servidor", () => ({ subirBuffer: vi.fn() }));
const F = await import("./fuentes-servidor");

describe("proyectoDeTokenCliente", () => {
  it("sólo acepta el enlace del cliente y vigente", async () => {
    db.fotofficeProyecto.findFirst.mockResolvedValue(null);
    const tok = "t".repeat(43);
    expect(await F.proyectoDeTokenCliente("ws", tok)).toBeNull();
    expect(db.fotofficeProyecto.findFirst.mock.calls[0][0].where).toMatchObject({ workspaceId: "ws", carpetaClienteHash: `h:${tok}` });
  });
  it("rechaza una carpeta vencida", async () => {
    db.fotofficeProyecto.findFirst.mockResolvedValue({ id: "p", clientId: "c", carpetaVence: new Date(Date.now() - 1000) });
    expect(await F.proyectoDeTokenCliente("ws", "t".repeat(43))).toBeNull();
  });
  it("acepta una carpeta vigente", async () => {
    db.fotofficeProyecto.findFirst.mockResolvedValue({ id: "p", clientId: "c", carpetaVence: new Date(Date.now() + 100000) });
    expect(await F.proyectoDeTokenCliente("ws", "t".repeat(43))).toMatchObject({ proyectoId: "p" });
  });
  it("rechaza tokens que no son texto", async () => {
    expect(await F.proyectoDeTokenCliente("ws", 123)).toBeNull();
  });
});

describe("fotosAptas", () => {
  it("deja sólo imágenes listas", async () => {
    db.fotofficeArchivoTrabajo.findMany.mockResolvedValue([
      { id: "1", nombre: "a.jpg", key: "k1", tipo: "image/jpeg", printSource: { width: 6000, height: 4000 } },
      { id: "2", nombre: "v.mp4", key: "k2", tipo: "video/mp4", printSource: null },
      { id: "3", nombre: "s.tif", key: "k3", tipo: "image/tiff", printSource: null },
    ]);
    const r = await F.fotosAptas("ws", "p");
    expect(r.map((x) => x.archivoId)).toEqual(["1", "3"]);
    expect(r[0]).toMatchObject({ width: 6000, height: 4000 });
    expect(r[1]).toMatchObject({ width: null, height: null });
  });
});

describe("resolverFuente", () => {
  const tok = "t".repeat(43);
  it("CARPETA arma las fotos con la miniatura de la carpeta y los datos del cliente", async () => {
    db.fotofficeProyecto.findFirst.mockResolvedValue({ id: "p", clientId: "c", carpetaVence: null });
    db.fotofficeArchivoTrabajo.findMany.mockResolvedValue([
      { id: "1", nombre: "a.jpg", key: "k1", tipo: "image/jpeg", printSource: { width: 6000, height: 4000 } },
      { id: "2", nombre: "v.mp4", key: "k2", tipo: "video/mp4", printSource: null },
    ]);
    db.client.findFirst.mockResolvedValue({ firstName: "Ana", lastName: "Paz", businessName: null, email: "ana@x.com", phone: "341" });
    const f = await F.resolverFuente("ws", "estudio", "CARPETA", tok);
    expect(f).toEqual({
      tipo: "CARPETA",
      proyectoOrigenId: "p",
      galeriaId: null,
      clientId: "c",
      nombre: "Ana Paz",
      email: "ana@x.com",
      telefono: "341",
      fotos: [{ id: "1", nombre: "a.jpg", key: "k1", width: 6000, height: 4000, mini: `/api/w/estudio/archivos/${tok}/mini/1` }],
    });
    expect(db.client.findFirst.mock.calls.at(-1)![0].where).toEqual({ id: "c", workspaceId: "ws" });
  });
  it("CARPETA sin cliente deja los datos en null", async () => {
    db.client.findFirst.mockClear();
    db.fotofficeProyecto.findFirst.mockResolvedValue({ id: "p", clientId: null, carpetaVence: null });
    db.fotofficeArchivoTrabajo.findMany.mockResolvedValue([]);
    const f = await F.resolverFuente("ws", "estudio", "CARPETA", tok);
    expect(f).toMatchObject({ clientId: null, nombre: null, email: null, telefono: null, fotos: [] });
    expect(db.client.findFirst).not.toHaveBeenCalled();
  });
  it("CARPETA usa la razón social si no hay nombre y apellido", async () => {
    db.fotofficeProyecto.findFirst.mockResolvedValue({ id: "p", clientId: "c", carpetaVence: null });
    db.fotofficeArchivoTrabajo.findMany.mockResolvedValue([]);
    db.client.findFirst.mockResolvedValue({ firstName: null, lastName: null, businessName: " Foto SA ", email: null, phone: null });
    expect(await F.resolverFuente("ws", "estudio", "CARPETA", tok)).toMatchObject({ nombre: "Foto SA", email: null, telefono: null });
  });
  it("token inválido o carpeta inexistente → null", async () => {
    expect(await F.resolverFuente("ws", "estudio", "CARPETA", 123)).toBeNull();
    db.fotofficeProyecto.findFirst.mockResolvedValue(null);
    expect(await F.resolverFuente("ws", "estudio", "CARPETA", tok)).toBeNull();
  });
});
