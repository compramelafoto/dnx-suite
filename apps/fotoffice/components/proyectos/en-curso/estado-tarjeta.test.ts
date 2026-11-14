import { describe, expect, it } from "vitest";
import type { TarjetaTrabajo } from "@/lib/proyectos/en-curso";
import { trabajosParaEntregar } from "./estado-tarjeta";

function tarjeta(journeyId: string, extra: Partial<TarjetaTrabajo> = {}): TarjetaTrabajo {
  return {
    proyectoId: `p-${journeyId}`,
    journeyId,
    numero: "T-1",
    nombre: "Copias",
    cliente: "Ana",
    telefono: null,
    email: null,
    producto: null,
    recorrido: { id: "c1", nombre: "Para retirar" },
    etapas: [],
    etapaActualId: "e1",
    fase: "LISTO",
    enteredStageAt: "2026-11-14T10:00:00.000Z",
    entrega: null,
    proveedor: null,
    proveedorId: null,
    enviadoAt: null,
    envio: null,
    pedido: { id: "ped1", numero: "P-1", saldoMinor: 500_000 },
    cerrado: false,
    cerradoAt: null,
    ...extra,
  };
}

describe("trabajosParaEntregar", () => {
  it("suma los otros trabajos listos del mismo pedido, con el tocado primero", () => {
    const a = tarjeta("a");
    const b = tarjeta("b");
    const enProceso = tarjeta("c", { fase: "EN_PROCESO" });
    const entregado = tarjeta("d", { cerrado: true, fase: "ENTREGADO" });
    const otroPedido = tarjeta("e", { pedido: { id: "ped2", numero: "P-2", saldoMinor: 100 } });
    expect(trabajosParaEntregar(b, [a, b, enProceso, entregado, otroPedido]).map((x) => x.journeyId)).toEqual(["b", "a"]);
  });

  it("sin pedido, sólo el trabajo tocado", () => {
    const a = tarjeta("a", { pedido: null });
    const b = tarjeta("b", { pedido: null });
    expect(trabajosParaEntregar(a, [a, b]).map((x) => x.journeyId)).toEqual(["a"]);
  });
});
