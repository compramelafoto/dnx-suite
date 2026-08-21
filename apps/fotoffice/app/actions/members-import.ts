"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { bulkCreateMembers, listMemberCategories, listMemberIdentifiersForWorkspace } from "@repo/db/fotoffice-members";
import { requireMembersManageContext } from "@/lib/members/access";
import { auditActorFrom } from "@/lib/members/audit";
import { documentDedupKey } from "@/lib/members/documents";
import { memberValuesToRepositoryInput } from "@/lib/members/schema";
import { normalizeEmail, parseAndValidateMemberImport, type ImportRowResult } from "@/lib/members/import/parse";
import { MEMBER_IMPORT_MAX_ROWS } from "@/lib/members/import/columns";

export type MemberImportValidationState =
  | { ok: false; error: string }
  | {
      ok: true;
      rows: ImportRowResult[];
      totalRows: number;
      validCount: number;
      warningCount: number;
      errorCount: number;
      workspaceName: string;
    };

async function loadWorkspaceLookups(workspaceId: string) {
  const [categories, identifiers] = await Promise.all([
    listMemberCategories(workspaceId),
    listMemberIdentifiersForWorkspace(workspaceId),
  ]);
  const categoriesByName = new Map<string, string>();
  for (const c of categories) categoriesByName.set(c.name.trim().toLowerCase(), c.id);
  const existingMemberNumbers = new Set(identifiers.memberNumbers);
  // Misma clave normalizada que usa el parser para las filas del CSV: si no, un `12.345.678`
  // del archivo no matchearía el `12345678` ya guardado y entraría como socio duplicado.
  const existingDocuments = new Set(
    identifiers.documents
      .map((d) => documentDedupKey(d.documentType, d.documentNumber))
      .filter((k): k is string => k !== null),
  );
  // Normalizados con el MISMO criterio que usa el parser para las filas del CSV, si no
  // `Socio@X.com` en la base no matchearía `socio@x.com` en el archivo.
  const existingEmails = new Set(
    identifiers.emails.map((e) => normalizeEmail(e)).filter((e): e is string => e !== null),
  );
  return { categoriesByName, existingMemberNumbers, existingDocuments, existingEmails };
}

/** PASO "Validar datos": parsea y valida, NO inserta nada en la base. */
export async function validateMemberImportAction(rawCsv: string): Promise<MemberImportValidationState> {
  const { workspace } = await requireMembersManageContext();
  if (!rawCsv.trim()) return { ok: false, error: "Pegá el CSV antes de validar." };

  const lookups = await loadWorkspaceLookups(workspace.id);
  const result = parseAndValidateMemberImport({ rawCsv, ...lookups });
  if (!result.ok) return result;

  return { ...result, ok: true, workspaceName: workspace.name };
}

export type MemberImportConfirmState =
  | { ok: false; error: string }
  | { ok: true; createdCount: number };

/**
 * PASO "Importar": vuelve a parsear y validar el MISMO texto (nunca confía
 * en filas ya "aprobadas" del lado del cliente — evita condiciones de
 * carrera si algo cambió en la base entre validar y confirmar) y recién
 * ahí inserta, todo dentro de una única transacción atómica.
 */
export async function confirmMemberImportAction(rawCsv: string): Promise<MemberImportConfirmState> {
  const { workspace, user } = await requireMembersManageContext();
  if (!rawCsv.trim()) return { ok: false, error: "No hay datos para importar." };

  const lookups = await loadWorkspaceLookups(workspace.id);
  const result = parseAndValidateMemberImport({ rawCsv, ...lookups });
  if (!result.ok) return { ok: false, error: result.error };
  if (result.errorCount > 0) {
    return { ok: false, error: "Hay filas con errores. Corregilas antes de importar." };
  }
  if (result.totalRows > MEMBER_IMPORT_MAX_ROWS) {
    return { ok: false, error: `El máximo por importación es ${MEMBER_IMPORT_MAX_ROWS} filas.` };
  }

  // Solo las filas que pasaron la validación. Una fila rechazada no se crea y por lo tanto
  // tampoco genera auditoría: el historial nunca registra algo que no ocurrió.
  const importable = result.rows.filter((r) => r.resolved);
  const inputs = importable.map((r) => memberValuesToRepositoryInput(r.resolved!));
  const sourceRows = importable.map((r) => r.rowNumber);

  if (inputs.length === 0) return { ok: false, error: "No hay filas válidas para importar." };

  try {
    const created = await bulkCreateMembers(workspace.id, inputs, {
      actor: auditActorFrom(user),
      // Un id por importación: permite recuperar el lote completo desde el historial.
      batchId: randomUUID(),
      sourceRows,
    });
    revalidatePath("/members");
    return { ok: true, createdCount: created.length };
  } catch {
    // No exponer el error crudo de Prisma; la transacción ya revirtió todo.
    return {
      ok: false,
      error: "No pudimos importar (algún dato choca con otro socio existente). No se creó ningún socio.",
    };
  }
}
