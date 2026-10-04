import test from "node:test";
import assert from "node:assert/strict";

import {
  asignacionesQuePuedeJuzgar,
  categoriasDondeCompite,
  categoriasDondeCompiteElJurado,
  type ClienteParaConflicto,
  type ObraDelJurado,
} from "./competir-y-juzgar";

function obra(p: Partial<ObraDelJurado> = {}): ObraDelJurado {
  return { categoryId: "cat-retrato", status: "CONFIRMED", withdrawnAt: null, ...p };
}

test("sin obras, no compite en ninguna categoría", () => {
  assert.equal(categoriasDondeCompite([]).size, 0);
});

test("una obra confirmada pone su categoría en conflicto", () => {
  const categorias = categoriasDondeCompite([obra()]);
  assert.ok(categorias.has("cat-retrato"));
});

test("las obras que todavía no se confirmaron también cuentan", () => {
  for (const status of ["UPLOADED", "PROCESSING", "REQUIRES_REVIEW", "READY_TO_CONFIRM"]) {
    const categorias = categoriasDondeCompite([obra({ status })]);
    assert.ok(categorias.has("cat-retrato"), `${status} debería contar como que compite`);
  }
});

test("un borrador no cuenta: nunca se envió", () => {
  assert.equal(categoriasDondeCompite([obra({ status: "DRAFT" })]).size, 0);
});

test("una obra rechazada, retirada o reemplazada ya no compite", () => {
  for (const status of ["REJECTED", "WITHDRAWN", "REPLACED"]) {
    assert.equal(
      categoriasDondeCompite([obra({ status })]).size,
      0,
      `${status} no debería contar`,
    );
  }
});

test("una obra con fecha de retiro no compite aunque su estado diga otra cosa", () => {
  const retirada = obra({ status: "CONFIRMED", withdrawnAt: new Date("2026-09-01") });
  assert.equal(categoriasDondeCompite([retirada]).size, 0);
});

test("varias obras en la misma categoría no la duplican", () => {
  const categorias = categoriasDondeCompite([obra(), obra(), obra()]);
  assert.equal(categorias.size, 1);
});

test("compite en las categorías donde tiene obra, no en las otras", () => {
  const categorias = categoriasDondeCompite([
    obra({ categoryId: "cat-retrato" }),
    obra({ categoryId: "cat-paisaje", status: "WITHDRAWN" }),
    obra({ categoryId: "cat-fauna" }),
  ]);
  assert.deepEqual([...categorias].sort(), ["cat-fauna", "cat-retrato"]);
});

const ASIGNACIONES = [
  { categoryId: "cat-retrato", id: "a1" },
  { categoryId: "cat-paisaje", id: "a2" },
  { categoryId: "cat-fauna", id: "a3" },
];

test("sin conflictos, las asignaciones quedan intactas", () => {
  const resultado = asignacionesQuePuedeJuzgar(ASIGNACIONES, new Set());
  assert.deepEqual(resultado, ASIGNACIONES);
});

test("la categoría donde compite desaparece de sus asignaciones", () => {
  const resultado = asignacionesQuePuedeJuzgar(ASIGNACIONES, new Set(["cat-retrato"]));
  assert.deepEqual(
    resultado.map((a) => a.id),
    ["a2", "a3"],
  );
});

test("puede quedarse sin ninguna asignación utilizable", () => {
  const todas = new Set(["cat-retrato", "cat-paisaje", "cat-fauna"]);
  assert.equal(asignacionesQuePuedeJuzgar(ASIGNACIONES, todas).length, 0);
});

test("no modifica el listado que recibe", () => {
  const original = [...ASIGNACIONES];
  asignacionesQuePuedeJuzgar(original, new Set(["cat-retrato"]));
  assert.deepEqual(original, ASIGNACIONES);
});

test("una categoría en conflicto que no tiene asignada no molesta", () => {
  const resultado = asignacionesQuePuedeJuzgar(ASIGNACIONES, new Set(["cat-arquitectura"]));
  assert.equal(resultado.length, 3);
});

/**
 * El cliente de base entra por parámetro, así que se puede probar la consulta
 * completa sin base: lo que importa acá es a quién se le pregunta qué.
 */
function clienteFalso(opciones: {
  email?: string | null;
  userId?: number | null;
  obras?: ObraDelJurado[];
}) {
  const preguntas: string[] = [];
  const cliente: ClienteParaConflicto = {
    fotorankJudgeAccount: {
      findUnique: async () => {
        preguntas.push("cuenta");
        return opciones.email ? { email: opciones.email } : null;
      },
    },
    user: {
      findUnique: async (args) => {
        preguntas.push("user:" + args.where.email);
        return opciones.userId ? { id: opciones.userId } : null;
      },
    },
    fotorankContestEntry: {
      findMany: async (args) => {
        preguntas.push("obras:" + args.where.contestId + ":" + args.where.authorUserId);
        return opciones.obras ?? [];
      },
    },
  };
  return { cliente, preguntas };
}

test("la persona que compite en una categoría queda en conflicto ahí", async () => {
  const { cliente } = clienteFalso({
    email: "jurado@ejemplo.com",
    userId: 42,
    obras: [obra({ categoryId: "cat-retrato" })],
  });

  const enConflicto = await categoriasDondeCompiteElJurado({
    judgeAccountId: "jue-1",
    contestId: "con-1",
    cliente,
  });

  assert.deepEqual([...enConflicto], ["cat-retrato"]);
});

test("busca al participante por el correo de la cuenta de jurado", async () => {
  const { cliente, preguntas } = clienteFalso({
    email: "jurado@ejemplo.com",
    userId: 42,
    obras: [],
  });

  await categoriasDondeCompiteElJurado({
    judgeAccountId: "jue-1",
    contestId: "con-1",
    cliente,
  });

  assert.ok(preguntas.includes("user:jurado@ejemplo.com"));
  assert.ok(preguntas.includes("obras:con-1:42"));
});

test("un jurado que nunca se inscribió a nada no tiene conflictos", async () => {
  const { cliente, preguntas } = clienteFalso({ email: "jurado@ejemplo.com", userId: null });

  const enConflicto = await categoriasDondeCompiteElJurado({
    judgeAccountId: "jue-1",
    contestId: "con-1",
    cliente,
  });

  assert.equal(enConflicto.size, 0);
  assert.ok(
    !preguntas.some((p) => p.startsWith("obras:")),
    "sin participante no hay por qué buscar obras",
  );
});

test("sin cuenta de jurado no se pregunta nada más", async () => {
  const { cliente, preguntas } = clienteFalso({ email: null });

  const enConflicto = await categoriasDondeCompiteElJurado({
    judgeAccountId: "jue-inexistente",
    contestId: "con-1",
    cliente,
  });

  assert.equal(enConflicto.size, 0);
  assert.deepEqual(preguntas, ["cuenta"]);
});

test("sólo mira las obras del concurso que se está juzgando", async () => {
  const { cliente, preguntas } = clienteFalso({
    email: "jurado@ejemplo.com",
    userId: 42,
    obras: [obra()],
  });

  await categoriasDondeCompiteElJurado({
    judgeAccountId: "jue-1",
    contestId: "con-otro",
    cliente,
  });

  assert.ok(preguntas.includes("obras:con-otro:42"));
});
