/**
 * Avisarle al jurado que ya puede calificar.
 *
 * En la primera Clickatón el juzgamiento se abrió y nadie se enteró: tres de
 * los cuatro jurados nunca entraron y las 270 obras quedaron sin calificar. El
 * aviso existía como plantilla, quedaba anotado en la auditoría y no se mandaba
 * a nadie.
 *
 * Los recuentos salen de `colaParaElVisor`, que es lo mismo que arma la
 * pantalla: así el correo no puede prometer un número distinto del que el
 * jurado va a ver al entrar.
 */
import { baseDelConcurso } from "./baseDelConcurso";
import {
  avisoDeJuzgamientoAbierto,
  recordatorioDeJuzgamiento,
  type CorreoArmado,
} from "./correosDelJurado";
import { colaParaElVisor } from "./visor-service";

/** Los estados en los que una asignación sigue viva. */
const ASIGNACIONES_VIVAS = [
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "EXTENDED",
] as const;

export type QueAvisar = "ABIERTO" | "RECORDATORIO";

export type AvisoParaUnJurado = {
  judgeAccountId: string;
  email: string;
  obras: number;
  consignas: number;
  criterios: number;
  /** Cuántas le faltan: las que no tienen todos los criterios puestos. */
  faltan: number;
  /** Por qué no se le manda, cuando corresponde no mandarle. */
  seSaltea: string | null;
  correo: CorreoArmado | null;
};

export type PlanDeAviso = {
  concurso: string;
  destinatarios: AvisoParaUnJurado[];
};

/**
 * Arma el plan sin mandar nada.
 *
 * Separar el armado del envío es lo que permite leer los correos completos,
 * con sus destinatarios reales, antes de que salgan hacia una persona.
 */
export async function planDeAviso(input: {
  contestId: string;
  que: QueAvisar;
  enlace: string;
}): Promise<PlanDeAviso> {
  const { db } = await baseDelConcurso(input.contestId);

  const contest = await db.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { title: true, judgingEndAt: true },
  });
  if (!contest) throw new Error(`No existe el concurso ${input.contestId}.`);

  const asignaciones = await db.fotorankJudgeAssignment.findMany({
    where: {
      contestId: input.contestId,
      assignmentStatus: { in: [...ASIGNACIONES_VIVAS] },
    },
    select: { judgeAccountId: true },
  });

  // Un jurado con varias asignaciones recibe un correo, no tres.
  const jurados = [...new Set(asignaciones.map((a) => a.judgeAccountId))];

  const destinatarios: AvisoParaUnJurado[] = [];
  for (const judgeAccountId of jurados) {
    destinatarios.push(
      await armarParaUno({
        judgeAccountId,
        contestId: input.contestId,
        concurso: contest.title,
        que: input.que,
        enlace: input.enlace,
        db,
      }),
    );
  }

  return { concurso: contest.title, destinatarios };
}

async function armarParaUno(input: {
  judgeAccountId: string;
  contestId: string;
  concurso: string;
  que: QueAvisar;
  enlace: string;
  db: Awaited<ReturnType<typeof baseDelConcurso>>["db"];
}): Promise<AvisoParaUnJurado> {
  const cuenta = await input.db.fotorankJudgeAccount.findUnique({
    where: { id: input.judgeAccountId },
    select: { email: true, accountStatus: true },
  });

  const vacio = {
    judgeAccountId: input.judgeAccountId,
    email: cuenta?.email ?? "",
    obras: 0,
    consignas: 0,
    criterios: 0,
    faltan: 0,
    correo: null,
  };

  if (!cuenta?.email) {
    return { ...vacio, seSaltea: "la cuenta no tiene correo" };
  }
  if (cuenta.accountStatus !== "ACTIVE") {
    return { ...vacio, seSaltea: `la cuenta está en ${cuenta.accountStatus}` };
  }

  const cola = await colaParaElVisor({
    judgeAccountId: input.judgeAccountId,
    contestId: input.contestId,
  });

  const claves = cola.rubrica?.criterios.map((c) => c.key) ?? [];
  const faltan = cola.obras.filter(
    (o) =>
      claves.length === 0 || claves.some((k) => typeof o.notas[k] !== "number"),
  ).length;

  const datos = {
    concurso: input.concurso,
    obras: cola.obras.length,
    consignas: cola.consignas.length,
    criterios: claves.length,
    enlace: input.enlace,
  };

  const comun = {
    ...datos,
    judgeAccountId: input.judgeAccountId,
    email: cuenta.email,
    faltan,
  };

  if (cola.obras.length === 0) {
    return { ...comun, correo: null, seSaltea: "no le tocó ninguna obra" };
  }
  if (input.que === "RECORDATORIO" && faltan === 0) {
    return { ...comun, correo: null, seSaltea: "ya calificó todas" };
  }

  return {
    ...comun,
    seSaltea: null,
    correo:
      input.que === "ABIERTO"
        ? avisoDeJuzgamientoAbierto(datos)
        : recordatorioDeJuzgamiento({ ...datos, faltan }),
  };
}
