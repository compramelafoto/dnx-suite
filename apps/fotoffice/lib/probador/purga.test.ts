import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/carpetas/almacen", () => ({ borrarArchivoGuardado: vi.fn() }));
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ bucketR2Privado: () => "b", clienteR2Privado: () => ({}) }));

const { sePuedeBorrar, SIN_PAGAR_MS, PAGADO_MS } = await import("./purga.server");

describe("cuándo se borran las fotos del probador", () => {
  it("sin pedido o sin pagar, a las 72 horas", () => {
    expect(sePuedeBorrar(SIN_PAGAR_MS - 1, null)).toBe(false);
    expect(sePuedeBorrar(SIN_PAGAR_MS, null)).toBe(true);
    expect(sePuedeBorrar(SIN_PAGAR_MS, "PENDIENTE_PAGO")).toBe(true);
  });

  it("pagado, recién a los 60 días", () => {
    expect(sePuedeBorrar(SIN_PAGAR_MS, "PAGADO")).toBe(false);
    expect(sePuedeBorrar(PAGADO_MS, "ENVIADO")).toBe(true);
  });
});
