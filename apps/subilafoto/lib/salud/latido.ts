import "server-only";

import { Prisma, prisma } from "@repo/db";

/**
 * Deja constancia de que un cron corrió.
 *
 * Una fila por tarea, actualizada en el lugar: cinco filas para siempre. No es un registro
 * histórico —para eso están los registros de Vercel— sino la respuesta a una sola
 * pregunta: **¿esto sigue corriendo?**
 *
 * Es la falla más silenciosa que puede tener el sistema. Un cron que deja de correr no
 * tira error ni rompe ninguna pantalla: las fotos simplemente no se moderan, y nadie se
 * entera hasta que alguien pregunta por qué la pantalla del salón está vacía.
 */

export async function conLatido<T>(nombre: string, tarea: () => Promise<T>): Promise<T> {
  const arranque = Date.now();

  try {
    const resultado = await tarea();
    await anotar(nombre, Date.now() - arranque, null, resultado);
    return resultado;
  } catch (e) {
    /*
      El error se anota y se vuelve a lanzar. Tragárselo dejaría el panel en verde
      justamente cuando hay algo que mirar, que es la única forma de que un panel de salud
      sea peor que no tener ninguno.
    */
    await anotar(nombre, Date.now() - arranque, mensajeDe(e), null);
    throw e;
  }
}

const mensajeDe = (e: unknown) =>
  e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 300) : "desconocido";

async function anotar(nombre: string, ms: number, error: string | null, resultado: unknown) {
  const ahora = new Date();

  try {
    await prisma.subilafotoCronRun.upsert({
      where: { nombre },
      create: {
        nombre,
        lastRunAt: ahora,
        lastOkAt: error ? null : ahora,
        lastError: error,
        lastMs: ms,
        lastResult: resumen(resultado),
        runs: 1,
      },
      update: {
        lastRunAt: ahora,
        // La última vez que salió bien se conserva: saber que hace tres horas andaba es
        // distinto de no saber nada.
        ...(error ? {} : { lastOkAt: ahora }),
        lastError: error,
        lastMs: ms,
        lastResult: resumen(resultado),
        runs: { increment: 1 },
      },
    });
  } catch {
    // Anotar el latido nunca puede romper el cron: si la base no responde, el trabajo ya
    // se hizo y perder la anotación es lo de menos.
  }
}

/** Sólo lo que entra en una fila. Un resultado gigante no aporta y ocupa. */
function resumen(resultado: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (resultado === null || resultado === undefined) return Prisma.DbNull;
  const texto = JSON.stringify(resultado);
  if (texto.length > 2000) return { recortado: true, largo: texto.length };
  return JSON.parse(texto) as Prisma.InputJsonValue;
}
