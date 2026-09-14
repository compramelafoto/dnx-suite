import { describe, expect, it, vi } from "vitest";
import { findOrCreateClient } from "./find-or-create";

/**
 * `findOrCreateClient` es la única puerta por la que Reservas y Ventas dan de alta un
 * cliente, y **siempre corre dentro de una transacción de quien la llama**. Eso es lo que
 * hace importantes estas pruebas: durante buena parte de la vida de este archivo el número
 * de cliente se asignaba con un `create` envuelto en un `catch` de P2002, y en PostgreSQL un
 * error dentro de `BEGIN…COMMIT` deja la transacción abortada — el reintento que el `for`
 * promete nunca llegaba a correr y la reserva o la venta entera terminaba en `ROLLBACK`.
 *
 * Son las mismas dos pruebas que `record-sale.test.ts` tiene para el correlativo de venta,
 * porque es exactamente el mismo mecanismo: `createMany` + `skipDuplicates` (que compila a
 * `ON CONFLICT DO NOTHING`, no tira error y deja viva la transacción) + relectura por el
 * único compuesto.
 */
// Mismo molde que `saleTx` en `lib/sales/record-sale.test.ts`: el objeto queda con su tipo
// inferido para poder leer los espías, y el `as never` va recién en cada llamada.
function clientTx<T extends Record<string, unknown>>(client: T) {
  return { client };
}

const input = { workspaceId: "w1", firstName: "Ana", lastName: "Pérez" };

describe("findOrCreateClient — el número de cliente se recalcula en el reintento", () => {
  it("si createMany choca (count 0), relee el último número y reintenta con el siguiente", async () => {
    let llamadas = 0;
    const tx = clientTx({
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => (llamadas === 0 ? { clientNumber: 5 } : { clientNumber: 6 })),
      createMany: vi.fn(async () => {
        llamadas += 1;
        // El primer intento (número 6) choca con otra caja dando de alta a la vez; el
        // segundo (número 7) gana la carrera.
        return llamadas === 1 ? { count: 0 } : { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(
        async ({ where }: { where: { workspaceId_clientNumber: { clientNumber: number } } }) => ({
          id: `cli-${where.workspaceId_clientNumber.clientNumber}`,
        }),
      ),
    });

    const resultado = await findOrCreateClient(tx as never, input);

    expect(tx.client.findFirst).toHaveBeenCalledTimes(2);
    expect(tx.client.createMany).toHaveBeenCalledTimes(2);
    // Releyó por el número que efectivamente ganó, no por el que había chocado.
    expect(resultado).toEqual({ id: "cli-7", created: true });
  });

  it("si los tres intentos chocan, lanza en vez de crear un cliente sin número", async () => {
    const tx = clientTx({
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      createMany: vi.fn(async () => ({ count: 0 })),
      findUniqueOrThrow: vi.fn(async () => {
        throw new Error("no debería llegar a releer: ningún intento ganó la carrera");
      }),
    });

    await expect(findOrCreateClient(tx as never, input)).rejects.toThrow(
      "No se pudo asignar un número de cliente después de tres intentos.",
    );
    expect(tx.client.createMany).toHaveBeenCalledTimes(3);
  });

  it("si ya existe un cliente con el mismo contacto, no crea otro", async () => {
    // El camino feliz que ninguna de las de arriba cubre: sin esto, un cambio en el
    // reintento podría dar de alta un duplicado por cada venta a un cliente conocido.
    const tx = clientTx({
      findMany: vi.fn(async () => [{ id: "cli-9", docNumber: null, email: "ana@x.com", phone: null }]),
      findFirst: vi.fn(async () => {
        throw new Error("no debería buscar número: el cliente ya existía");
      }),
      createMany: vi.fn(async () => {
        throw new Error("no debería crear nada: el cliente ya existía");
      }),
    });

    const resultado = await findOrCreateClient(tx as never, { ...input, email: "ANA@x.com" });

    expect(resultado).toEqual({ id: "cli-9", created: false });
  });
});
