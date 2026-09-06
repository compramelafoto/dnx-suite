"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { importHistoricalPayments } from "@/lib/membership/history-import/import";
import {
  parseAndValidatePaymentImport,
  type PaymentImportRow,
} from "@/lib/membership/history-import/parse";
import { buildPaymentImportPrompt } from "@/lib/membership/history-import/prompt";

/**
 * Importación del registro de pagos anterior a FotoOffice.
 *
 * Dos pasos, como la importación de socios: primero se valida y se muestra qué va a pasar,
 * después se confirma. La confirmación **vuelve a parsear el mismo texto** en vez de confiar
 * en las filas que el navegador dice haber aprobado: entre una pantalla y la otra pudo
 * cambiar el padrón, y las filas del cliente son entrada del usuario, no un dato verificado.
 */

type ImportContext =
  | { ok: false; error: string }
  | { ok: true; workspace: { id: string; name: string } };

async function contexto(): Promise<ImportContext> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay una institución activa." };
  if (!(await canManageWorkspaceCollection(user.id, workspace.id))) {
    return { ok: false, error: "Solo quien administra los cobros puede importar pagos." };
  }
  return { ok: true, workspace: { id: workspace.id, name: workspace.name } };
}

/**
 * El padrón y los pagos ya importados, en dos consultas. Nunca una consulta por fila: con
 * varios años de historia eso serían miles de viajes a la base.
 */
async function lookups(workspaceId: string) {
  const [socios, yaImportados] = await Promise.all([
    prisma.member.findMany({
      where: { workspaceId },
      select: { id: true, memberNumber: true, firstName: true, lastName: true },
    }),
    prisma.membershipPayment.findMany({
      where: { workspaceId, providerPaymentRef: { startsWith: "HIST:" } },
      select: { providerPaymentRef: true },
    }),
  ]);

  const membersByNumber = new Map(
    socios.map((s) => [
      s.memberNumber,
      { id: s.id, fullName: `${s.lastName}, ${s.firstName}` },
    ]),
  );
  const existingDedupKeys = new Set(
    yaImportados.map((p) => p.providerPaymentRef).filter((r): r is string => r !== null),
  );
  return { membersByNumber, existingDedupKeys };
}

export type PaymentImportValidationState =
  | { ok: false; error: string }
  | {
      ok: true;
      rows: PaymentImportRow[];
      totalRows: number;
      validCount: number;
      warningCount: number;
      errorCount: number;
      /** Cuántas se van a escribir de verdad: las válidas y las que sólo tienen avisos. */
      willImport: number;
    };

/** Paso «revisar»: valida y no escribe nada. */
export async function validatePaymentImportAction(
  rawCsv: string,
): Promise<PaymentImportValidationState> {
  const ctx = await contexto();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!rawCsv.trim()) return { ok: false, error: "Pegá el CSV antes de revisar." };

  const resultado = parseAndValidatePaymentImport({
    rawCsv,
    workspaceId: ctx.workspace.id,
    ...(await lookups(ctx.workspace.id)),
  });
  if (!resultado.ok) return resultado;

  return {
    ...resultado,
    ok: true,
    willImport: resultado.rows.filter((r) => r.resolved !== undefined).length,
  };
}

export type PaymentImportConfirmState =
  | { ok: false; error: string }
  | { ok: true; imported: number; skipped: number };

/**
 * Paso «importar».
 *
 * Se exige que no haya ninguna fila con error: importar «lo que se pueda» de un archivo que
 * el sistema no entendió del todo deja un historial incompleto que nadie va a auditar
 * después. Las filas con aviso sí entran — un pago sin medio declarado sigue siendo un pago.
 */
export async function confirmPaymentImportAction(
  rawCsv: string,
): Promise<PaymentImportConfirmState> {
  const ctx = await contexto();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!rawCsv.trim()) return { ok: false, error: "No hay datos para importar." };

  const resultado = parseAndValidatePaymentImport({
    rawCsv,
    workspaceId: ctx.workspace.id,
    ...(await lookups(ctx.workspace.id)),
  });
  if (!resultado.ok) return { ok: false, error: resultado.error };
  if (resultado.errorCount > 0) {
    return {
      ok: false,
      error: `Hay ${resultado.errorCount} fila(s) con errores. Corregilas y volvé a revisar antes de importar.`,
    };
  }

  const pagos = resultado.rows
    .map((r) => r.resolved)
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  const salida = await importHistoricalPayments({
    workspaceId: ctx.workspace.id,
    payments: pagos,
  });

  revalidatePath("/members/cuotas");
  revalidatePath("/members");
  return { ok: true, ...salida };
}

/** El texto para pegar en ChatGPT junto a la planilla desordenada. */
export async function paymentImportPromptAction(): Promise<
  { ok: true; prompt: string } | { ok: false; error: string }
> {
  const ctx = await contexto();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  return { ok: true, prompt: buildPaymentImportPrompt({ workspaceName: ctx.workspace.name }) };
}
