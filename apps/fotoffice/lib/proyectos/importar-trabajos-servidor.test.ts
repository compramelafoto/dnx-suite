import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La importación de trabajos con todo lo de afuera falseado: sólo importa qué informa la fila
 * cuando el motor no deja avanzar un trabajo (el candado del saldo).
 */
const F = vi.hoisted(() => ({
  prisma: {
    product: { findMany: vi.fn() },
    fotofficeProveedor: { findMany: vi.fn() },
    client: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    fotofficeProyectoNota: { count: vi.fn(), create: vi.fn() },
    fotofficeProyecto: { findMany: vi.fn(), updateMany: vi.fn() },
  },
  crearPedidoManual: vi.fn(),
  moverAFase: vi.fn(),
}));

vi.mock("@repo/db", () => ({ prisma: F.prisma }));
vi.mock("@/lib/clients/alta", () => ({ crearClienteConNumero: vi.fn() }));
vi.mock("@/lib/pedidos/pedidos", () => ({ crearPedidoManual: F.crearPedidoManual }));
vi.mock("./avance", () => ({ moverAFase: F.moverAFase }));
vi.mock("./acceso", () => ({ puedeGestionarProyectos: () => true, MENSAJES_PROYECTO: { sinPermiso: "Sin permiso." } }));

const { importarTrabajos } = await import("./importar-trabajos-servidor");

const CTX = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF" } as unknown as Parameters<typeof importarTrabajos>[0];
const FILA = {
  renglon: 2, cliente: "Laura Pérez", telefono: "3415551234", tipo: "VHS" as const, detalle: "3 casetes",
  total: 10000, sena: 5000, fase: "LISTO" as const, entrega: null, clave: "k1",
};

beforeEach(() => {
  vi.clearAllMocks();
  F.prisma.product.findMany.mockResolvedValue([{ id: "prod-vhs", name: "Digitalización de VHS", fotofficeProyectoReglas: [] }]);
  F.prisma.fotofficeProveedor.findMany.mockResolvedValue([]);
  F.prisma.client.findMany.mockResolvedValue([{ id: "c1", firstName: "Laura", lastName: "Pérez", businessName: null, phone: "3415551234" }]);
  F.prisma.user.findUnique.mockResolvedValue({ name: "Ana", email: null });
  F.prisma.fotofficeProyectoNota.count.mockResolvedValue(0);
  F.prisma.fotofficeProyecto.findMany.mockResolvedValue([{ id: "pr-1" }]);
  F.crearPedidoManual.mockResolvedValue({ ok: true, pedidoId: "ped-1", numero: "PED-12" });
});

describe("importarTrabajos", () => {
  it("si el motor no deja avanzar el trabajo, la fila lo dice con el motivo", async () => {
    const candado = "El pedido PED-12 debe $ 5.000. Cobrá el saldo antes de entregar.";
    F.moverAFase.mockResolvedValue({ ok: false, error: candado });
    const r = await importarTrabajos(CTX, [FILA]);
    expect(r).toEqual({
      ok: true,
      resultados: [{ renglon: 2, cliente: "Laura Pérez", estado: "IMPORTADO", detalle: `Pedido PED-12 · debe $ 5.000 · no avanzó de etapa: ${candado}` }],
    });
  });

  it("si avanza, informa la etapa como siempre", async () => {
    F.moverAFase.mockResolvedValue({ ok: true, movido: true, etapa: "Listo para retirar" });
    const r = await importarTrabajos(CTX, [FILA]);
    expect(r.ok && r.resultados[0]!.detalle).toBe("Pedido PED-12 · debe $ 5.000 · en «Listo para retirar»");
  });
});
