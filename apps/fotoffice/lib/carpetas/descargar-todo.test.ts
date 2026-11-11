import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  proyecto: null as Record<string, unknown> | null,
  archivos: [] as Record<string, unknown>[],
  notas: [] as string[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({
  prisma: {
    fotofficeProyecto: {
      findFirst: vi.fn(async () => H.proyecto),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    fotofficeArchivoTrabajo: { findMany: vi.fn(async () => H.archivos) },
    fotofficePedido: { findFirst: vi.fn(async () => ({ items: [{ id: "m1", productId: "p", nombre: "Imán 10x15", cantidad: 3, precioUnitario: 1 }] })) },
    fotofficeProveedor: { findFirst: vi.fn(async () => ({ name: "La Isla" })) },
    fotofficeProyectoNota: { create: vi.fn(async (a: { data: { body: string } }) => H.notas.push(a.data.body)) },
  },
}));
vi.mock("./almacen", () => ({
  urlDeLecturaArchivo: async (k: string) => `https://r2/${k}`,
  flujoDeArchivo: async () => (async function* () { yield new TextEncoder().encode("foto"); })(),
  borrarArchivoGuardado: vi.fn(), tamanoDeArchivo: vi.fn(), urlDeSubidaArchivo: vi.fn(),
}));
vi.mock("@/lib/presupuestos/sitio", () => ({ sitioDelWorkspace: vi.fn() }));
vi.mock("@/lib/presupuestos/versiones", () => ({ itemsGuardados: (raw: unknown) => raw }));
vi.mock("@/lib/proyectos/acceso", () => ({ MENSAJES_PROYECTO: {}, puedeGestionarProyectos: () => true }));

const { descargarTodoDelLaboratorio } = await import("./carpeta");
const TOKEN = "A".repeat(43);

beforeEach(() => {
  H.notas = [];
  H.proyecto = { id: "t1", proveedorId: "isla", number: "2026-0040", name: "x", carpetaVence: null, pedidoId: "ped", pedidoItemIndex: 0, client: { firstName: "Ana", lastName: "Gómez", businessName: null }, product: { name: "Imán 10x15" } };
});

describe("descargarTodoDelLaboratorio", () => {
  it("con sólo el ZIP del pedido para laboratorio, baja ese ZIP", async () => {
    H.archivos = [{ id: "z", key: "k/z", nombre: "Pedido-8.zip", tipo: "application/zip", bytes: 10n, createdAt: new Date() }];
    expect(await descargarTodoDelLaboratorio("ws", TOKEN)).toEqual({ tipo: "UNO", url: "https://r2/k/z" });
    expect(H.notas).toEqual(["La Isla descargó los archivos."]);
  });

  it("con archivos sueltos arma un ZIP Trabajo > Tamaño > Acabado > Copias > nombre original", async () => {
    H.archivos = [
      { id: "a", key: "k/a", nombre: "IMG_123.jpg", tipo: "image/jpeg", bytes: 4n, createdAt: new Date() },
      { id: "b", key: "k/b", nombre: "IMG_124.jpg", tipo: "image/jpeg", bytes: 4n, createdAt: new Date() },
    ];
    const r = await descargarTodoDelLaboratorio("ws", TOKEN);
    expect(r?.tipo).toBe("ZIP");
    if (r?.tipo !== "ZIP") return;
    const partes: Buffer[] = [];
    for await (const p of r.flujo) partes.push(p);
    const zip = Buffer.concat(partes).toString("utf8");
    expect(r.nombre).toBe("Trabajo-2026-0040.zip");
    expect(zip).toContain("Trabajo 2026-0040 - Ana Gómez/10x15/Imán/3 copias/IMG_123.jpg");
    expect(zip).toContain("Trabajo 2026-0040 - Ana Gómez/10x15/Imán/3 copias/IMG_124.jpg");
  });

  it("enlace vencido o sin archivos: nada", async () => {
    H.archivos = [];
    expect(await descargarTodoDelLaboratorio("ws", TOKEN)).toBeNull();
    H.proyecto = { ...H.proyecto!, carpetaVence: new Date("2020-01-01") };
    expect(await descargarTodoDelLaboratorio("ws", TOKEN)).toBeNull();
  });
});
