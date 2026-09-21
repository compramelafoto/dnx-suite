import { prisma } from "@repo/db";

/**
 * Nadie juzga la categoría donde compite.
 *
 * Una misma persona puede ser jurado y participante en FotoRank, y eso está
 * bien mientras no se califique a sí misma ni a quienes compiten contra ella.
 * La unidad de la regla es la **categoría**, no la obra, porque es ahí donde
 * se compite: ocultarle sólo sus propias fotos lo dejaría calificando a sus
 * rivales directos.
 *
 * Es distinto del conflicto de interés que ya existía
 * (`FotorankJudgeEntryConflict`): aquél lo declara el jurado, obra por obra,
 * por conocer al autor o tener una relación con él. Éste no se declara — se
 * deduce de los datos y no se puede desactivar.
 *
 * El vínculo entre las dos identidades es el correo: la cuenta de jurado
 * (`FotorankJudgeAccount`) y la de participante (`User`) son registros
 * separados y el correo es lo único que las une.
 */

/**
 * Estados de obra que cuentan como "compite".
 *
 * `CONFIRMED` es la obra en juego. Los estados previos (subida, en proceso,
 * lista para confirmar) también cuentan: la evaluación y la inscripción
 * pueden solaparse, y una obra que se confirma a mitad de la evaluación
 * convertiría en tramposo a alguien que ya calificó de buena fe. Ante la
 * duda, la persona no juzga: perder un jurado es barato, un fallo impugnado
 * no lo es.
 *
 * Quedan afuera los estados donde la obra ya no compite —rechazada, retirada
 * o reemplazada— y `DRAFT`, que es un borrador que nunca se envió.
 */
const ESTADOS_QUE_COMPITEN = new Set([
  "UPLOADED",
  "PROCESSING",
  "REQUIRES_REVIEW",
  "READY_TO_CONFIRM",
  "CONFIRMED",
]);

export type ObraDelJurado = {
  categoryId: string;
  status: string;
  withdrawnAt: Date | null;
};

/**
 * Las categorías donde esta persona tiene obra compitiendo.
 *
 * `withdrawnAt` se mira aparte del estado porque una obra puede quedar con
 * fecha de retiro sin que su estado lo refleje.
 */
export function categoriasDondeCompite(obras: ObraDelJurado[]): Set<string> {
  const categorias = new Set<string>();
  for (const obra of obras) {
    if (obra.withdrawnAt) continue;
    if (!ESTADOS_QUE_COMPITEN.has(obra.status)) continue;
    categorias.add(obra.categoryId);
  }
  return categorias;
}

export type AsignacionConCategoria = { categoryId: string };

/**
 * Saca del listado las asignaciones de categorías donde la persona compite.
 *
 * Devuelve un array nuevo. Si no compite en ninguna, devuelve el mismo que
 * recibió, para que quien no esté en esta situación —la enorme mayoría— no
 * pague nada.
 */
export function asignacionesQuePuedeJuzgar<T extends AsignacionConCategoria>(
  asignaciones: T[],
  categoriasEnConflicto: Set<string>,
): T[] {
  if (categoriasEnConflicto.size === 0) return asignaciones;
  return asignaciones.filter((a) => !categoriasEnConflicto.has(a.categoryId));
}

/**
 * Qué decirle a quien se quedó sin nada para juzgar por competir.
 *
 * El mensaje explica la causa. "No tenés asignación en este concurso" sería
 * mentira: la asignación existe, lo que no puede es usarla.
 */
export const MENSAJE_COMPITE_EN_TODAS =
  "Tenés obras compitiendo en las categorías que te asignaron, así que no podés calificarlas. Si creés que es un error, hablá con el organizador del concurso.";

/**
 * Lo mínimo que esta regla necesita de un cliente de base.
 *
 * Se declara así, y no como el tipo de Prisma, porque la consulta corre contra
 * dos bases distintas: la de FotoRank y la de Clickatón, que comparten esquema
 * pero son clientes separados. Un jurado puede tener asignaciones en las dos.
 */
export type ClienteParaConflicto = {
  fotorankJudgeAccount: {
    findUnique: (args: {
      where: { id: string };
      select: { email: true };
    }) => Promise<{ email: string } | null>;
  };
  user: {
    findUnique: (args: {
      where: { email: string };
      select: { id: true };
    }) => Promise<{ id: number } | null>;
  };
  fotorankContestEntry: {
    findMany: (args: {
      where: { contestId: string; authorUserId: number };
      select: { categoryId: true; status: true; withdrawnAt: true };
    }) => Promise<ObraDelJurado[]>;
  };
};

/**
 * Las categorías de este concurso donde el jurado tiene obra compitiendo.
 *
 * Dos consultas y no una porque las identidades están separadas: primero el
 * correo de la cuenta de jurado, después las obras de la persona que usa ese
 * mismo correo en el sitio. Sin `User`, la persona nunca se inscribió a nada
 * y no hay nada que mirar.
 *
 * La base se busca donde vive el concurso: preguntarle a FotoRank por las
 * obras de una maratón de Clickatón devolvería cero y dejaría pasar
 * exactamente el caso que hay que frenar.
 *
 * Fail-closed al revés que de costumbre: si esto falla, la excepción sube. No
 * se puede "ante la duda dejar calificar" — la duda es justamente lo que esta
 * regla existe para impedir.
 */
export async function categoriasDondeCompiteElJurado(input: {
  judgeAccountId: string;
  contestId: string;
  /** La base donde vive el concurso. Por omisión, la de FotoRank. */
  cliente?: ClienteParaConflicto;
}): Promise<Set<string>> {
  const db = input.cliente ?? (prisma as unknown as ClienteParaConflicto);

  const cuenta = await db.fotorankJudgeAccount.findUnique({
    where: { id: input.judgeAccountId },
    select: { email: true },
  });
  if (!cuenta?.email) return new Set();

  const participante = await db.user.findUnique({
    where: { email: cuenta.email },
    select: { id: true },
  });
  if (!participante) return new Set();

  const obras = await db.fotorankContestEntry.findMany({
    where: { contestId: input.contestId, authorUserId: participante.id },
    select: { categoryId: true, status: true, withdrawnAt: true },
  });

  return categoriasDondeCompite(obras);
}
