import { describe, expect, it, vi } from "vitest";
import { releaseVoidedPrintOrderCharge } from "./void-order";

/**
 * Anular un pedido tiene que sacarle la deuda de encima al socio.
 *
 * El bug que esto cierra: la Secretaría anulaba un pedido de carnet y el cargo quedaba vivo.
 * El socio pedía otro, y terminaba debiendo dos credenciales habiendo recibido ninguna.
 */

function clienteFalso(opciones: {
  card?: { printOrderChargeId: string | null } | null;
  imputaciones?: number;
}) {
  const cardUpdate = vi.fn().mockResolvedValue({});
  const chargeDelete = vi.fn().mockResolvedValue({});
  return {
    espias: { cardUpdate, chargeDelete },
    tx: {
      memberCard: {
        findUnique: vi.fn().mockResolvedValue(
          opciones.card === undefined ? { printOrderChargeId: "cargo-1" } : opciones.card,
        ),
        update: cardUpdate,
      },
      membershipAllocation: {
        count: vi.fn().mockResolvedValue(opciones.imputaciones ?? 0),
      },
      membershipCharge: { delete: chargeDelete },
    },
  };
}

describe("releaseVoidedPrintOrderCharge", () => {
  it("borra el cargo del pedido que nadie pagó", async () => {
    const { tx, espias } = clienteFalso({ imputaciones: 0 });

    const r = await releaseVoidedPrintOrderCharge(tx as never, "card-1");

    expect(r).toBe("BORRADO");
    expect(espias.chargeDelete).toHaveBeenCalledWith({ where: { id: "cargo-1" } });
    // El carnet deja de apuntar a un cargo que ya no existe.
    expect(espias.cardUpdate).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { printOrderChargeId: null },
    });
  });

  it("conserva el cargo que el socio ya pagó, para la próxima tarjeta", async () => {
    // La plata entró y está conciliada: borrarla dejaría un pago imputado a la nada. El cargo
    // queda enganchado al pedido anulado y la próxima reimpresión lo reutiliza sin cobrar de
    // nuevo, que es lo justo cuando el carnet salió mal por culpa de la institución.
    const { tx, espias } = clienteFalso({ imputaciones: 1 });

    const r = await releaseVoidedPrintOrderCharge(tx as never, "card-1");

    expect(r).toBe("CONSERVADO");
    expect(espias.chargeDelete).not.toHaveBeenCalled();
    expect(espias.cardUpdate).not.toHaveBeenCalled();
  });

  it("no hace nada con un carnet que nunca tuvo cargo", async () => {
    // El carnet digital y los emitidos a mano por la Secretaría no cobran nada.
    const { tx, espias } = clienteFalso({ card: { printOrderChargeId: null } });

    const r = await releaseVoidedPrintOrderCharge(tx as never, "card-1");

    expect(r).toBe("SIN_CARGO");
    expect(espias.chargeDelete).not.toHaveBeenCalled();
  });
});
