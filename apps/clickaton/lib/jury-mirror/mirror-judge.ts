/**
 * Ficha espejo del jurado en la base de Clickatón.
 *
 * No es una cuenta y no sirve para entrar: la identidad se valida siempre
 * contra el padrón maestro, que vive en la base de FotoRank. Esta fila existe
 * únicamente porque `FotorankJudgeAssignment` tiene clave foránea a
 * `FotorankJudgeAccount`, y las claves foráneas no cruzan bases.
 *
 * Revocar el acceso en el maestro lo revoca en todas partes, porque acá no hay
 * credencial que valga.
 */

/**
 * Valor imposible para `passwordHash`, que la base exige obligatorio.
 *
 * No empieza con `$`, así que ningún verificador de bcrypt o argon2 lo acepta
 * como hash, y el texto avisa qué es para quien lo encuentre en una consulta.
 */
export const SENTINEL_PASSWORD_HASH = "espejo-no-login:sin-credencial-en-clickaton";

export function isSentinelPasswordHash(value: string): boolean {
  return value === SENTINEL_PASSWORD_HASH;
}

/** Workspace único que sostiene las fichas espejo. */
export const JURY_WORKSPACE_ID = "ck-workspace-jurados";
export const JURY_WORKSPACE_NAME = "Jurados";

type UpsertArgs = {
  where: { id: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};

type MirrorTx = {
  workspace: { upsert(args: UpsertArgs): Promise<unknown> };
  fotorankJudgeAccount: { upsert(args: UpsertArgs): Promise<unknown> };
};

type MirrorPrisma = MirrorTx & {
  $transaction<T>(fn: (tx: MirrorTx) => Promise<T>): Promise<T>;
};

/**
 * Copia la ficha mínima del jurado a la base de Clickatón.
 *
 * El workspace va primero porque la ficha cuelga de él. Todo en una
 * transacción: una ficha a medias dejaría la asignación imposible de crear.
 */
export async function mirrorJudgeAccount(input: {
  prisma: MirrorPrisma;
  judge: { id: string; email: string };
}): Promise<void> {
  await input.prisma.$transaction(async (tx) => {
    await tx.workspace.upsert({
      where: { id: JURY_WORKSPACE_ID },
      create: { id: JURY_WORKSPACE_ID, name: JURY_WORKSPACE_NAME },
      update: {},
    });
    await tx.fotorankJudgeAccount.upsert({
      where: { id: input.judge.id },
      create: {
        id: input.judge.id,
        workspaceId: JURY_WORKSPACE_ID,
        email: input.judge.email,
        passwordHash: SENTINEL_PASSWORD_HASH,
        accountStatus: "ACTIVE",
      },
      // El correo puede cambiar en el maestro; la credencial nunca se toca acá.
      update: { email: input.judge.email },
    });
  });
}
