/**
 * La ficha espejo del jurado existe sólo para que las claves foráneas cierren.
 * No es una cuenta: su passwordHash es un centinela que ninguna contraseña
 * puede satisfacer.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  JURY_WORKSPACE_ID,
  SENTINEL_PASSWORD_HASH,
  isSentinelPasswordHash,
  mirrorJudgeAccount,
} from "./mirror-judge";

test("el centinela no parece un hash válido de bcrypt ni de argon2", () => {
  assert.ok(!SENTINEL_PASSWORD_HASH.startsWith("$2"));
  assert.ok(!SENTINEL_PASSWORD_HASH.startsWith("$argon2"));
  assert.ok(!SENTINEL_PASSWORD_HASH.startsWith("$"));
});

test("el centinela se reconoce", () => {
  assert.equal(isSentinelPasswordHash(SENTINEL_PASSWORD_HASH), true);
});

test("un hash real no se confunde con el centinela", () => {
  assert.equal(
    isSentinelPasswordHash("$2b$10$abcdefghijklmnopqrstuv0123456789012345678901234567890"),
    false,
  );
  assert.equal(isSentinelPasswordHash(""), false);
});

test("el centinela dice en texto que no es una cuenta", () => {
  assert.match(SENTINEL_PASSWORD_HASH, /no-login/);
});

test("la copia crea el workspace y la ficha en una sola transacción", async () => {
  const llamadas: string[] = [];
  let datosFicha: Record<string, unknown> | null = null;
  const tx = {
    workspace: {
      upsert: async (args: any) => {
        llamadas.push("workspace");
        assert.equal(args.where.id, JURY_WORKSPACE_ID);
        return {};
      },
    },
    fotorankJudgeAccount: {
      upsert: async (args: any) => {
        llamadas.push("judge");
        datosFicha = args.create;
        return {};
      },
    },
  };
  const prisma = {
    ...tx,
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };

  await mirrorJudgeAccount({
    prisma: prisma as never,
    judge: { id: "j1", email: "jurado@ejemplo.com" },
  });

  assert.deepEqual(llamadas, ["workspace", "judge"], "el workspace va primero");
  assert.equal(datosFicha!.passwordHash, SENTINEL_PASSWORD_HASH);
  assert.equal(datosFicha!.workspaceId, JURY_WORKSPACE_ID);
  assert.equal(datosFicha!.id, "j1");
});

test("ninguna ruta de Clickatón autentica contra la tabla espejo", async () => {
  // La copia no es una puerta de entrada. Si alguien más adelante intenta
  // usarla para iniciar sesión, esta prueba se lo dice.
  const { execFileSync } = await import("node:child_process");
  let salida = "";
  try {
    salida = execFileSync("grep", ["-rn", "fotorankJudgeAccount", "app", "lib"], {
      encoding: "utf8",
    });
  } catch {
    // grep sale con 1 cuando no encuentra nada: es el caso bueno.
    salida = "";
  }
  const sospechosas = salida
    .split("\n")
    .filter((l) => l.trim() && !l.includes("lib/jury-mirror/"));
  assert.deepEqual(
    sospechosas,
    [],
    `Sólo lib/jury-mirror puede tocar fotorankJudgeAccount en Clickatón:\n${sospechosas.join("\n")}`,
  );
});
