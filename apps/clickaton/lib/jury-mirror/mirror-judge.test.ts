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
  type UpsertArgs = {
    where: { id: string };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  };
  const tx = {
    workspace: {
      upsert: async (args: UpsertArgs) => {
        llamadas.push("workspace");
        assert.equal(args.where.id, JURY_WORKSPACE_ID);
        return {};
      },
    },
    fotorankJudgeAccount: {
      upsert: async (args: UpsertArgs) => {
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

test("nadie toca la tabla espejo con el cliente local de Clickatón", async () => {
  // La copia no es una puerta de entrada. Lo que se prohíbe no es nombrar la
  // tabla — `lib/jury-directory` la consulta legítimamente en el padrón maestro,
  // con un cliente inyectado — sino alcanzarla con el Prisma local de
  // Clickatón, que es el único que ve la copia.
  const { execFileSync } = await import("node:child_process");
  const { readFileSync } = await import("node:fs");

  function grep(patron: string): string[] {
    try {
      return execFileSync("grep", ["-rl", patron, "app", "lib"], { encoding: "utf8" })
        .split("\n")
        .filter(Boolean);
    } catch {
      // grep sale con 1 cuando no encuentra nada: es el caso bueno.
      return [];
    }
  }

  const tocanLaTabla = grep("fotorankJudgeAccount").filter(
    (f) => !f.includes("lib/jury-mirror/"),
  );
  const conClienteLocal = tocanLaTabla.filter((archivo) => {
    const contenido = readFileSync(archivo, "utf8");
    return (
      contenido.includes('from "@/lib/admin/db"') ||
      contenido.includes('from "@repo/db"')
    );
  });

  assert.deepEqual(
    conClienteLocal,
    [],
    `Estos archivos alcanzan fotorankJudgeAccount con el Prisma local de Clickatón:\n${conClienteLocal.join("\n")}`,
  );
});
