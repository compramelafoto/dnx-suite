import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { asignarNumero, type NumeroAsignado } from "@/lib/numeracion/asignar";
import { asegurarSecuencias } from "@/lib/numeracion/secuencias";

/**
 * Número de las consultas de Captación (0.5). Cada consulta recibe número en una transacción
 * PROPIA, después de que el alta confirmó: en Postgres una sentencia que falla aborta toda la
 * transacción, y la numeración nunca puede llevarse puesta la consulta. Si falla, la consulta
 * queda sin número y la numera el próximo enganche (al abrir Captación), en orden de alta.
 */

export const TIPO_CONSULTA = "CONSULTA";

/** Sólo el tipo y el código del error: nunca su mensaje (puede traer datos de la consulta). */
function registrarFalla(donde: string, error: unknown): void {
  const e = error as { name?: string; code?: string } | null;
  console.error(`[captacion] ${donde} falló`, { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
}

/** Numera una consulta en su propia transacción. Idempotente: si ya tenía número, lo devuelve. */
export function numerarConsulta(workspaceId: string, leadId: string, alta: Date): Promise<NumeroAsignado> {
  return prisma.$transaction((tx: Prisma.TransactionClient) =>
    asignarNumero(tx, { workspaceId, key: "CONSULTA", entityType: TIPO_CONSULTA, entityId: leadId, fecha: alta }),
  );
}

/*
 * SQL crudo: Prisma no sabe expresar "sin número" (el número nombra a la consulta por
 * `entityId`, sin relación). Los valores van siempre como parámetros. El comentario
 * `consultas-sin-numero` lo usa la base en memoria de las pruebas para reconocerlas. Usan el
 * índice único (entityType, entityId) de FotofficeRecordNumber.
 */

/**
 * ¿Hay otra consulta del workspace todavía sin número? No compara fechas en SQL (la columna es
 * sin zona horaria): cualquier otra sin número es anterior o se está dando de alta a la vez.
 */
async function hayOtrasSinNumero(workspaceId: string, leadId: string): Promise<boolean> {
  const filas = await prisma.$queryRaw<{ hay: number }[]>`
    /* consultas-sin-numero: otra */
    SELECT 1 AS "hay"
    FROM "ServiceSalesLead" l
    WHERE l."workspaceId" = ${workspaceId}
      AND l."id" <> ${leadId}
      AND NOT EXISTS (
        SELECT 1 FROM "FotofficeRecordNumber" r
        WHERE r."entityType" = 'CONSULTA' AND r."entityId" = l."id"
      )
    LIMIT 1`;
  return filas.length > 0;
}

/**
 * Lo que hace cada alta de consulta, DESPUÉS de crearla: le da número. Nunca lanza.
 *
 * Si hay otras consultas todavía sin número (las de antes de la numeración, una cuya numeración
 * falló o una que se está dando de alta a la vez), no la numera: las numera el enganche, todas
 * en orden de alta. Así una consulta nueva nunca le gana el número a una vieja del mismo año.
 */
export async function numerarConsultaNueva(workspaceId: string, leadId: string, alta: Date): Promise<NumeroAsignado | null> {
  try {
    if (await hayOtrasSinNumero(workspaceId, leadId)) return null;
    return await numerarConsulta(workspaceId, leadId, alta);
  } catch (error) {
    registrarFalla("numerarConsultaNueva", error);
    return null;
  }
}

type ConsultaSinNumero = { id: string; createdAt: Date };

/** Hasta `limite` consultas del workspace sin número, de la más vieja a la más nueva. */
async function consultasSinNumero(workspaceId: string, limite: number): Promise<ConsultaSinNumero[]> {
  return prisma.$queryRaw<ConsultaSinNumero[]>`
    /* consultas-sin-numero: lista */
    SELECT l."id", l."createdAt"
    FROM "ServiceSalesLead" l
    WHERE l."workspaceId" = ${workspaceId}
      AND NOT EXISTS (
        SELECT 1 FROM "FotofficeRecordNumber" r
        WHERE r."entityType" = 'CONSULTA' AND r."entityId" = l."id"
      )
    ORDER BY l."createdAt" ASC, l."id" ASC
    LIMIT ${limite}`;
}

/**
 * Parte del enganche: numera hasta `tope` consultas sin número, de la más vieja a la más nueva
 * (desempata el id), cada una con el año de su alta en Buenos Aires y en su propia transacción.
 * Una falla no frena a las demás (se reintenta en la próxima llamada). `completo` es true si no
 * quedó ninguna sin número. Idempotente: una consulta ya numerada no se lee ni se toca.
 */
export async function numerarConsultasPendientes(workspaceId: string, tope: number): Promise<{ numeradas: number; completo: boolean }> {
  const lote = await consultasSinNumero(workspaceId, tope + 1);
  if (lote.length === 0) return { numeradas: 0, completo: true };
  await asegurarSecuencias(workspaceId);
  let numeradas = 0;
  let fallidas = 0;
  for (const lead of lote.slice(0, tope)) {
    try {
      await numerarConsulta(workspaceId, lead.id, new Date(lead.createdAt));
      numeradas++;
    } catch (error) {
      fallidas++;
      registrarFalla("numerarConsultasPendientes", error);
    }
  }
  return { numeradas, completo: lote.length <= tope && fallidas === 0 };
}

/** Título de la ficha: "Consulta N° 2026-0042 · Nombre", o sólo el nombre si todavía no tiene número. */
export function tituloDeConsulta(nombre: string, numero: string | null | undefined): string {
  return numero ? `Consulta N° ${numero} · ${nombre}` : nombre;
}
