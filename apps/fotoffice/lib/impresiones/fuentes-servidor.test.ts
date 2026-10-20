import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  fotofficeProyecto: { findFirst: vi.fn() },
  fotofficeArchivoTrabajo: { findMany: vi.fn() },
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
