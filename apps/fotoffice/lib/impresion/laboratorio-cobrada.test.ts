import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Preparar para laboratorio, sin imágenes: anular una preparación ya cobrada y el botón del
 * Mostrador. No toca R2 ni sharp (por eso vive aparte de `laboratorio-servidor.test.ts`).
 */

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("./almacen", () => ({}));
vi.mock("./render", () => ({}));
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ clienteR2Privado: () => ({}), bucketR2Privado: () => "b", esNoEncontrado: () => false }));

const P = await import("./preparaciones");
const L = await import("./laboratorio-servidor");

const WS = "ws-1";
const CTX = { workspaceId: WS, userId: 1, userLabel: "Sabi" };

beforeEach(() => B.vaciar());

describe("anularPreparacion", () => {
  it("no anula una preparación de laboratorio ya cobrada (LISTA)", async () => {
    B.agregar("fotofficePreparacionImpresion", { id: "prep1", workspaceId: WS, destino: "LABORATORIO", estado: "LISTA", saleItemId: null });
    expect(await P.anularPreparacion(CTX, "prep1")).toEqual({ ok: false, error: "Esa preparación ya se cobró: no se puede anular." });
    expect(B.datos.fotofficePreparacionImpresion[0]).toMatchObject({ estado: "LISTA" });
  });

  it("una de laboratorio que todavía se prepara sí se anula", async () => {
    B.agregar("fotofficePreparacionImpresion", { id: "prep1", workspaceId: WS, destino: "LABORATORIO", estado: "PREPARANDO", saleItemId: null });
    expect(await P.anularPreparacion(CTX, "prep1")).toEqual({ ok: true });
    expect(B.datos.fotofficePreparacionImpresion[0]).toMatchObject({ estado: "ANULADA" });
  });

  it("de otro negocio no existe", async () => {
    B.agregar("fotofficePreparacionImpresion", { id: "prep1", workspaceId: "ws-2", destino: "LABORATORIO", estado: "LISTA", saleItemId: null });
    expect(await P.anularPreparacion(CTX, "prep1")).toEqual({ ok: false, error: "Esa preparación no existe." });
  });
});

describe("hayCopiasDeLaboratorio", () => {
  const producto = (id: string, name: string, extra: Record<string, unknown> = {}) =>
    B.agregar("product", { id, workspaceId: WS, name, priceArs: "500", costArs: null, isActive: true, preferredProveedorId: null, ...extra });

  it("sólo con copias instantáneas no hay botón", async () => {
    producto("i10", "Copia instantánea 10x15");
    producto("i13", "Copia instantánea 13x18");
    expect(await L.hayCopiasDeLaboratorio(WS)).toBe(false);
  });

  it("con una copia para mañana o para la próxima semana, sí", async () => {
    producto("i10", "Copia instantánea 10x15");
    producto("m10", "Copia para mañana 10x15");
    expect(await L.hayCopiasDeLaboratorio(WS)).toBe(true);
    B.vaciar();
    producto("s20", "Ampliación 20x30");
    expect(await L.hayCopiasDeLaboratorio(WS)).toBe(true);
  });

  it("no mira productos inactivos ni de otro negocio", async () => {
    producto("m10", "Copia para mañana 10x15", { isActive: false });
    producto("m13", "Copia para mañana 13x18", { workspaceId: "ws-2" });
    expect(await L.hayCopiasDeLaboratorio(WS)).toBe(false);
  });
});
