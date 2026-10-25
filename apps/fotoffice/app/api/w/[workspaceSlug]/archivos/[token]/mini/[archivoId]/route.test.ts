import { beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-unused-vars -- los mocks reciben argumentos que la prueba lee con `mock.calls` */
const H = vi.hoisted(() => ({
  encendido: vi.fn(async (..._a: unknown[]) => true),
  proyecto: vi.fn(async (..._a: unknown[]) => ({ proyectoId: "p1", clientId: "c1" }) as unknown),
  archivo: vi.fn(async (..._a: unknown[]) => ({ id: "a1", key: "trabajos/ws/p1/a1/foto.jpg" }) as unknown),
}));
vi.mock("@repo/db", () => ({ prisma: { fotofficeArchivoTrabajo: { findFirst: H.archivo } } }));
vi.mock("@/lib/presupuestos/sitio", () => ({ workspaceDelSlug: async () => "ws" }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.encendido }));
vi.mock("@/lib/impresiones/fuentes-servidor", () => ({ proyectoDeTokenCliente: H.proyecto, asegurarMiniatura: async () => ({ thumbKey: "mini/a1.jpg" }) }));
vi.mock("@/lib/carpetas/almacen", () => ({ urlDeLecturaArchivo: async () => "https://r2.test/mini/a1.jpg" }));

const { GET } = await import("./route");
const llamar = () => GET(new Request("https://fotoffice.test/x"), { params: Promise.resolve({ workspaceSlug: "dnx", token: "tok", archivoId: "a1" }) });

beforeEach(() => {
  vi.clearAllMocks();
  H.encendido.mockResolvedValue(true);
});

describe("miniatura de la carpeta del cliente", () => {
  it("con el módulo de impresiones encendido redirige a la miniatura", async () => {
    const r = await llamar();
    expect(r.status).toBe(302);
    expect(H.encendido).toHaveBeenCalledWith("ws", "print-orders");
  });
  it("con el módulo apagado da 404 sin tocar nada", async () => {
    H.encendido.mockResolvedValue(false);
    expect((await llamar()).status).toBe(404);
    expect(H.proyecto).not.toHaveBeenCalled();
  });
});
