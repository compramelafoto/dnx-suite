import test from "node:test";
import assert from "node:assert/strict";

import { asignarJuradoAMaraton, listarJuradosAsignables } from "./service";
import { JURY_WORKSPACE_ID, SENTINEL_PASSWORD_HASH } from "../jury-mirror/mirror-judge";

type FilaDelPadron = {
  id: string;
  email: string;
  accountStatus: string;
  profile: { firstName: string | null; lastName: string | null; directoryReviewStatus: string } | null;
};

function padronFalso(filas: FilaDelPadron[]) {
  return {
    fotorankJudgeAccount: {
      findMany: async () => filas,
    },
  };
}

function maratonFalsa(yaAsignadas: Array<{ judgeAccountId: string; categoryId: string }> = []) {
  const escrituras: string[] = [];
  const creadas: Array<Record<string, unknown>> = [];
  // Las tablas van aparte de `$transaction` para que este objeto no se
  // referencie a sí mismo dentro de su propia definición.
  const tablas = {
    fotorankJudgeAssignment: {
      findMany: async () => yaAsignadas,
      createMany: async (args: { data: Array<Record<string, unknown>> }) => {
        escrituras.push("asignacion");
        creadas.push(...args.data);
        return {};
      },
    },
    workspace: {
      upsert: async () => {
        escrituras.push("workspace");
        return {};
      },
    },
    fotorankJudgeAccount: {
      upsert: async (args: { create: Record<string, unknown> }) => {
        escrituras.push("ficha-espejo");
        creadas.push(args.create);
        return {};
      },
    },
  };

  const maraton = {
    ...tablas,
    $transaction: async <T,>(fn: (tx: typeof tablas) => Promise<T>): Promise<T> => fn(tablas),
  };

  return { maraton, escrituras, creadas };
}

const APROBADA: FilaDelPadron = {
  id: "jur-1",
  email: "jurado@ejemplo.com",
  accountStatus: "ACTIVE",
  profile: { firstName: "Ana", lastName: "Pérez", directoryReviewStatus: "APPROVED" },
};

const SIN_APROBAR: FilaDelPadron = {
  id: "jur-2",
  email: "otro@ejemplo.com",
  accountStatus: "ACTIVE",
  profile: { firstName: "Luis", lastName: "Gómez", directoryReviewStatus: "PENDING" },
};

const BASE = {
  organizationId: "ck-org",
  contestId: "ck-contest",
  createdByUserId: 1,
  methodType: "SCORE_1_10",
};

test("sin conexión al padrón se devuelve null, no una lista vacía", async () => {
  assert.equal(await listarJuradosAsignables(null), null);
});

test("el padrón sólo ofrece a quien puede trabajar", async () => {
  const lista = await listarJuradosAsignables(padronFalso([APROBADA, SIN_APROBAR]));
  assert.deepEqual(lista?.map((j) => j.id), ["jur-1"]);
});

test("el nombre sale del perfil, y si no hay queda en null", async () => {
  const lista = await listarJuradosAsignables(
    padronFalso([APROBADA, { ...APROBADA, id: "jur-3", profile: null }]),
  );
  assert.equal(lista?.[0]?.nombre, "Ana Pérez");
  assert.equal(lista?.length, 1, "sin perfil no hay ficha aprobada, así que no se ofrece");
});

test("la ficha espejo se escribe ANTES que la asignación", async () => {
  const { maraton, escrituras } = maratonFalsa();
  const r = await asignarJuradoAMaraton({
    ...BASE,
    padron: padronFalso([APROBADA]),
    maraton,
    judgeAccountId: "jur-1",
    categoryIds: ["cat-a"],
  });
  assert.equal(r.ok, true);
  assert.deepEqual(
    escrituras,
    ["workspace", "ficha-espejo", "asignacion"],
    "al revés es imposible: la asignación cuelga de la ficha",
  );
});

test("la ficha espejo nunca lleva una contraseña usable", async () => {
  const { maraton, creadas } = maratonFalsa();
  await asignarJuradoAMaraton({
    ...BASE,
    padron: padronFalso([APROBADA]),
    maraton,
    judgeAccountId: "jur-1",
    categoryIds: ["cat-a"],
  });
  const ficha = creadas.find((c) => c.passwordHash !== undefined);
  assert.ok(ficha, "debería haberse creado la ficha espejo");
  assert.equal(ficha!.passwordHash, SENTINEL_PASSWORD_HASH);
  assert.equal(ficha!.workspaceId, JURY_WORKSPACE_ID);
});

test("asignar dos categorías crea dos asignaciones", async () => {
  const { maraton } = maratonFalsa();
  const r = await asignarJuradoAMaraton({
    ...BASE,
    padron: padronFalso([APROBADA]),
    maraton,
    judgeAccountId: "jur-1",
    categoryIds: ["cat-a", "cat-b"],
  });
  assert.ok(r.ok && r.creadas === 2);
});

test("repetir una asignación no falla: se informa que ya estaba", async () => {
  const { maraton, escrituras } = maratonFalsa([
    { judgeAccountId: "jur-1", categoryId: "cat-a" },
  ]);
  const r = await asignarJuradoAMaraton({
    ...BASE,
    padron: padronFalso([APROBADA]),
    maraton,
    judgeAccountId: "jur-1",
    categoryIds: ["cat-a"],
  });
  assert.ok(r.ok && r.creadas === 0 && r.yaEstaban === 1);
  assert.deepEqual(escrituras, [], "sin nada que crear, no se toca ninguna base");
});

test("a alguien que no está en el padrón no se le asigna nada", async () => {
  const { maraton, escrituras } = maratonFalsa();
  const r = await asignarJuradoAMaraton({
    ...BASE,
    padron: padronFalso([APROBADA]),
    maraton,
    judgeAccountId: "jur-inexistente",
    categoryIds: ["cat-a"],
  });
  assert.equal(r.ok, false);
  assert.deepEqual(escrituras, [], "no se escribe nada si la identidad no vale");
});

test("a una ficha sin aprobar no se le asigna, aunque se pida por id", async () => {
  const { maraton, escrituras } = maratonFalsa();
  const r = await asignarJuradoAMaraton({
    ...BASE,
    padron: padronFalso([APROBADA, SIN_APROBAR]),
    maraton,
    judgeAccountId: "jur-2",
    categoryIds: ["cat-a"],
  });
  assert.equal(r.ok, false, "la identidad se valida contra el maestro, no contra lo que llega");
  assert.deepEqual(escrituras, []);
});

test("sin conexión a alguna de las dos bases no se escribe nada", async () => {
  const { maraton } = maratonFalsa();
  const sinPadron = await asignarJuradoAMaraton({
    ...BASE,
    padron: null,
    maraton,
    judgeAccountId: "jur-1",
    categoryIds: ["cat-a"],
  });
  assert.equal(sinPadron.ok, false);

  const sinMaraton = await asignarJuradoAMaraton({
    ...BASE,
    padron: padronFalso([APROBADA]),
    maraton: null,
    judgeAccountId: "jur-1",
    categoryIds: ["cat-a"],
  });
  assert.equal(sinMaraton.ok, false);
});

test("sin categorías no se asigna nada", async () => {
  const { maraton, escrituras } = maratonFalsa();
  const r = await asignarJuradoAMaraton({
    ...BASE,
    padron: padronFalso([APROBADA]),
    maraton,
    judgeAccountId: "jur-1",
    categoryIds: [],
  });
  assert.equal(r.ok, false);
  assert.deepEqual(escrituras, []);
});
