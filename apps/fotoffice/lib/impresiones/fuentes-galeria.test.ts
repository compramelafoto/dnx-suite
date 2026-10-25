import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La fuente GALERIA de los pedidos de impresión, contra la base en memoria y la regla REAL de
 * `lib/galerias/publico.ts` (las mismas fotos cuyo original puede bajar el cliente).
 */
const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/presupuestos/sitio", () => ({ sitioDelWorkspace: async () => null, workspaceDelSlug: async () => "ws-1" }));
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ bucketR2Privado: () => "b", clienteR2Privado: () => ({ send: vi.fn() }) }));
vi.mock("@/lib/carpetas/subir-servidor", () => ({ subirBuffer: vi.fn() }));
const firmarLote = vi.fn(async (fotos: { id: string; viewKey: string | null; thumbKey: string | null }[]) =>
  new Map(fotos.map((f) => [f.id, { thumbUrl: f.thumbKey ? `https://r2.test/${f.thumbKey}?firma` : null, viewUrl: f.viewKey ? `https://r2.test/${f.viewKey}?firma` : null }])),
);
vi.mock("@/lib/galerias/almacen", () => ({
  urlsDeLecturaPorLote: firmarLote,
  urlDeLecturaFoto: vi.fn(),
  urlDeDescargaFoto: vi.fn(),
  urlDeDescargaOriginal: vi.fn(),
  urlDeReproduccionVideo: vi.fn(),
}));

const F = await import("./fuentes-servidor");
const { tokenDeGaleriaCliente, hashDeToken } = await import("@/lib/galerias/enlace");

const EMITIDO = new Date("2026-10-01T12:00:00.000Z");
const token = (id: string) => tokenDeGaleriaCliente(id, EMITIDO, "clave-de-prueba");
const TOKEN1 = token("gc1");
const galeria = () => B.datos.fotofficeGaleria.find((g) => g.id === "g1")!;
const cliente = () => B.datos.fotofficeGaleriaCliente.find((c) => c.id === "gc1")!;
const resolver = (t: unknown = TOKEN1) => F.resolverFuente("ws-1", "estudio", "GALERIA", t);

function sembrarFoto(id: string, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeGaleriaFoto", {
    id, workspaceId: "ws-1", galeriaId: "g1", fileName: `${id}.jpg`, originalKey: `o/${id}`, viewKey: `v/${id}`, thumbKey: `t/${id}`,
    status: "LISTA", width: 6000, height: 4000, order: 0, mediaType: "FOTO", ...extra,
  });
}
function pagar(fotoIds: string[], status = "PAGADA") {
  const id = `c-${Math.random()}`;
  B.agregar("fotofficeGaleriaCompra", { id, workspaceId: "ws-1", galeriaId: "g1", galeriaClienteId: "gc1", status, extraCount: fotoIds.length, subtotalArs: "1.00", totalArs: "1.00", pricingSnapshot: {} });
  for (const fotoId of fotoIds) B.agregar("fotofficeGaleriaCompraFoto", { compraId: id, fotoId });
}

beforeEach(() => {
  vi.clearAllMocks();
  B.vaciar();
  B.agregar("fotofficeGaleria", {
    id: "g1", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Boda", status: "PUBLICADA", kind: "SELECCION", orderMode: "NOMBRE",
    downloadMode: "SELECCIONADAS", saleMode: "VENTA", includedCount: 0, pricingMode: "POR_FOTO", unitPriceArs: "1500.00",
  });
  B.agregar("fotofficeGaleriaCliente", {
    id: "gc1", workspaceId: "ws-1", galeriaId: "g1", clientId: "cl1", name: "Ana Gómez", email: "ana@x.com", phone: "341555",
    tokenHash: hashDeToken(TOKEN1), tokenIssuedAt: EMITIDO,
  });
  for (const id of ["f1", "f2", "f3"]) sembrarFoto(id);
});

describe("resolverFuente · GALERIA", () => {
  it("sólo las fotos que el cliente puede bajar en original (pagadas), con sus datos y la miniatura firmada", async () => {
    pagar(["f1", "f3"]);
    pagar(["f2"], "PENDIENTE");
    const f = await resolver();
    expect(f).toEqual({
      tipo: "GALERIA",
      proyectoOrigenId: "pr1",
      galeriaId: "g1",
      clientId: "cl1",
      nombre: "Ana Gómez",
      email: "ana@x.com",
      telefono: "341555",
      fotos: [
        { id: "f1", nombre: "f1.jpg", key: "o/f1", width: 6000, height: 4000, mini: "https://r2.test/t/f1?firma" },
        { id: "f3", nombre: "f3.jpg", key: "o/f3", width: 6000, height: 4000, mini: "https://r2.test/t/f3?firma" },
      ],
    });
  });
  it("sin miniatura usa la vista grande", async () => {
    sembrarFoto("f4", { thumbKey: null });
    pagar(["f4"]);
    const f = await resolver();
    expect(f?.fotos).toEqual([expect.objectContaining({ id: "f4", mini: "https://r2.test/v/f4?firma" })]);
  });
  it("sin fotos imprimibles → null (no hay pantalla para pedir)", async () => {
    expect(await resolver()).toBeNull();
  });
  it.each(["VISTA", "NINGUNA"])("con downloadMode %s no hay nada para imprimir → null", async (modo) => {
    pagar(["f1"]);
    galeria().downloadMode = modo;
    expect(await resolver()).toBeNull();
  });
  it("una ENTREGA ofrece todas sus fotos listas, sin videos ni pendientes", async () => {
    galeria().kind = "ENTREGA";
    galeria().downloadMode = "NINGUNA";
    sembrarFoto("v1", { fileName: "v1.mp4", viewKey: null, thumbKey: null, width: null, height: null, mediaType: "VIDEO" });
    sembrarFoto("fp", { status: "PENDIENTE" });
    const f = await resolver();
    expect(f?.fotos.map((x) => x.id)).toEqual(["f1", "f2", "f3"]);
  });
  it("un álbum no ofrece copias", async () => {
    galeria().kind = "ALBUM";
    pagar(["f1"]);
    expect(await resolver()).toBeNull();
  });
  it("enlace anulado, galería no publicada o token inválido → null", async () => {
    pagar(["f1"]);
    expect(await resolver("A".repeat(43))).toBeNull();
    expect(await resolver(123)).toBeNull();
    galeria().status = "ARCHIVADA";
    expect(await resolver()).toBeNull();
    galeria().status = "PUBLICADA";
    cliente().revokedAt = new Date();
    expect(await resolver()).toBeNull();
  });
  it("cliente sin ficha: clientId y teléfono en null", async () => {
    pagar(["f1"]);
    cliente().clientId = null;
    cliente().phone = null;
    expect(await resolver()).toMatchObject({ clientId: null, telefono: null, nombre: "Ana Gómez" });
  });
});
