import { describe, expect, it } from "vitest";
import { resumenDePlan } from "./estado";
import { armarVistaPedido } from "./vista-publica";

const ORG = { nombre: "DNX Estudio", logoUrl: null, whatsappUrl: null, email: null };
const CUOTAS = [
  { id: "c1", position: 1, dueDate: "2026-10-15", amountArs: 282_000, suggestedMethod: "TRANSFERENCIA" },
  { id: "c2", position: 2, dueDate: "2026-11-15", amountArs: 658_000, suggestedMethod: "TRANSFERENCIA" },
];
const DATOS = { alias: "dnx.estudio.mp", cbuCvu: null, titular: "Daniel Cuart", cuit: null, banco: "Mercado Pago" };

function vista(extra: Partial<Parameters<typeof armarVistaPedido>[0]> = {}, estado: "CONFIRMADO" | "CANCELADO" = "CONFIRMADO") {
  return armarVistaPedido({
    organizacion: ORG, numero: "P-1", estado, eventDate: "2027-03-20", eventLabel: "Boda", items: [], totals: null, formaDePago: null,
    plan: resumenDePlan(CUOTAS, [], { hoy: "2026-10-15", estadoPedido: estado, total: 940_000 }), recibos: [], ...extra,
  });
}

describe("enlace del pedido: pagar por transferencia (etapa B)", () => {
  it("sin Mercado Pago y con datos para transferir: sólo transferencia", () => {
    const v = vista({ cobrosHabilitados: false, transferencia: DATOS });
    expect(v.transferencia).toEqual(DATOS);
    expect(v.plan.cuotas.map((c) => [c.pagable, c.transferible, c.esperando])).toEqual([[false, true, null], [false, true, null]]);
  });

  it("la cuota que ya eligió transferir muestra el monto exacto (con el monto único)", () => {
    const v = vista({ transferencia: DATOS, esperas: new Map([["c1", 282_037]]) });
    expect(v.plan.cuotas[0]).toMatchObject({ esperando: 282_037 });
    expect(v.plan.cuotas[1]).toMatchObject({ esperando: null });
  });

  it("sin datos para transferir o con el pedido cancelado: no se ofrece", () => {
    expect(vista().transferencia).toBeNull();
    expect(vista().plan.cuotas.every((c) => !c.transferible)).toBe(true);
    expect(vista({ transferencia: DATOS }, "CANCELADO").transferencia).toBeNull();
  });
});
