import { describe, expect, it } from "vitest";
import { Prisma } from "@repo/db";
import { resolverObjetivoDeInscripcion } from "./enrollment-target";

const d = (v: string) => new Prisma.Decimal(v);

describe("a qué se inscribe y cuánto paga", () => {
  it("un grabado se compra sin edición, al precio del curso", () => {
    const r = resolverObjetivoDeInscripcion({
      deliveryMode: "RECORDED",
      precioDelCurso: d("45000"),
      instancia: null,
      cuposLibres: null,
    });
    expect(r).toEqual({ ok: true, courseInstanceId: null, monto: d("45000") });
  });

  it("un grabado sin precio no se puede comprar", () => {
    const r = resolverObjetivoDeInscripcion({
      deliveryMode: "RECORDED",
      precioDelCurso: null,
      instancia: null,
      cuposLibres: null,
    });
    expect(r.ok).toBe(false);
  });

  it("un grabado con precio cero tampoco: sería regalar un curso pago por error", () => {
    const r = resolverObjetivoDeInscripcion({
      deliveryMode: "RECORDED",
      precioDelCurso: d("0"),
      instancia: null,
      cuposLibres: null,
    });
    expect(r.ok).toBe(false);
  });

  it("a un grabado no se le puede colar una edición", () => {
    const r = resolverObjetivoDeInscripcion({
      deliveryMode: "RECORDED",
      precioDelCurso: d("45000"),
      instancia: { id: "e1", status: "ACTIVE", priceArs: d("10") },
      cuposLibres: 3,
    });
    expect(r).toEqual({ ok: false, error: "Un curso grabado no tiene ediciones: se organiza en clases." });
  });

  it("un presencial sigue exigiendo edición activa con cupo, al precio de la edición", () => {
    const instancia = { id: "e1", status: "ACTIVE", priceArs: d("30000") };
    expect(
      resolverObjetivoDeInscripcion({ deliveryMode: "PRESENCIAL", precioDelCurso: null, instancia, cuposLibres: 2 }),
    ).toEqual({ ok: true, courseInstanceId: "e1", monto: d("30000") });
    expect(
      resolverObjetivoDeInscripcion({ deliveryMode: "PRESENCIAL", precioDelCurso: null, instancia, cuposLibres: 0 }).ok,
    ).toBe(false);
    expect(
      resolverObjetivoDeInscripcion({
        deliveryMode: "PRESENCIAL",
        precioDelCurso: null,
        instancia: { ...instancia, status: "CANCELLED" },
        cuposLibres: 2,
      }).ok,
    ).toBe(false);
    expect(
      resolverObjetivoDeInscripcion({ deliveryMode: "PRESENCIAL", precioDelCurso: null, instancia: null, cuposLibres: null }).ok,
    ).toBe(false);
  });
});
