import { test } from "node:test";
import assert from "node:assert/strict";
import { exigirReverificacionDeIdentidad } from "./reverificar-identidad";

type Fila = { userId: number; status: string; reverifyRequiredAt: Date | null };

/** Doble mínimo de la transacción: guarda filas en memoria y aplica `updateMany`. */
function txFalsa(filas: Fila[]) {
  return {
    identityVerification: {
      async updateMany(args: { where: { userId: number }; data: { reverifyRequiredAt: Date } }) {
        const afectadas = filas.filter((f) => f.userId === args.where.userId);
        for (const f of afectadas) f.reverifyRequiredAt = args.data.reverifyRequiredAt;
        return { count: afectadas.length };
      },
    },
  };
}

test("con identidad verificada, el cambio de correo marca la reverificación", async () => {
  const ahora = new Date("2026-11-26T12:00:00Z");
  const filas: Fila[] = [{ userId: 7, status: "APPROVED", reverifyRequiredAt: null }];
  await exigirReverificacionDeIdentidad(txFalsa(filas), 7, ahora);
  assert.equal(filas[0]!.reverifyRequiredAt?.getTime(), ahora.getTime());
});

test("no toca la identidad de otra persona", async () => {
  const filas: Fila[] = [{ userId: 8, status: "APPROVED", reverifyRequiredAt: null }];
  await exigirReverificacionDeIdentidad(txFalsa(filas), 7, new Date());
  assert.equal(filas[0]!.reverifyRequiredAt, null);
});

test("sin fila de identidad no hace nada ni falla", async () => {
  await assert.doesNotReject(exigirReverificacionDeIdentidad(txFalsa([]), 7, new Date()));
});
