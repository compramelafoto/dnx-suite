import { test } from "node:test";
import assert from "node:assert/strict";
import { loadVerifiedPhotographer } from "./sello-verificado";

type Fila = { status: string; reverifyRequiredAt: Date | null } | null;

function prismaFalso(resultado: Fila | Error) {
  const llamadas: unknown[] = [];
  return {
    llamadas,
    db: {
      identityVerification: {
        async findUnique(args: unknown) {
          llamadas.push(args);
          if (resultado instanceof Error) throw resultado;
          return resultado;
        },
      },
    },
  };
}

test("aprobado y fotógrafo: true, con consulta mínima", async () => {
  const p = prismaFalso({ status: "APPROVED", reverifyRequiredAt: null });
  assert.equal(await loadVerifiedPhotographer(p.db, 5, "PHOTOGRAPHER"), true);
  assert.deepEqual(p.llamadas[0], {
    where: { userId: 5 },
    select: { status: true, reverifyRequiredAt: true },
  });
});

test("otro rol: false", async () => {
  const p = prismaFalso({ status: "APPROVED", reverifyRequiredAt: null });
  assert.equal(await loadVerifiedPhotographer(p.db, 5, "CUSTOMER"), false);
});

test("si la consulta falla (tabla inexistente): false y un solo console.error", async () => {
  const p = prismaFalso(new Error("relation IdentityVerification does not exist"));
  const original = console.error;
  const logs: unknown[][] = [];
  console.error = (...a: unknown[]) => void logs.push(a);
  try {
    assert.equal(await loadVerifiedPhotographer(p.db, 5, "PHOTOGRAPHER"), false);
  } finally {
    console.error = original;
  }
  assert.equal(logs.length, 1);
});
