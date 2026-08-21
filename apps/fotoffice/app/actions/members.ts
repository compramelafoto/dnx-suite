"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createMember,
  createMemberCategory,
  getMember,
  MemberConcurrencyError,
  updateMember,
  updateMemberCategory,
} from "@repo/db/fotoffice-members";
import { requireMembersManageContext } from "@/lib/members/access";
import { auditActorFrom, normalizeReason, statusRequiresReason } from "@/lib/members/audit";
import { documentChanged, normalizeDocument } from "@/lib/members/documents";
import {
  formToMemberPayload,
  friendlyMemberCategoryError,
  friendlyMemberError,
  memberCategorySchema,
  memberSchema,
  memberValuesToRepositoryInput,
} from "@/lib/members/schema";
import { isMemberStatus } from "@/lib/members/status-labels";

export type MemberFormState = { error: string | null; fieldErrors?: Record<string, string> };

/**
 * Rechaza un documento mal formado. Devuelve el error de campo listo, o null si está bien.
 * El caller decide CUÁNDO llamarla — en el alta siempre, en la edición solo si el documento
 * cambió, para no invalidar retroactivamente socios ya cargados.
 */
function documentFieldError(
  values: { documentType?: string | null; documentNumber?: string | null },
): MemberFormState | null {
  const doc = normalizeDocument(values.documentType, values.documentNumber);
  if (doc.validationStatus !== "INVALID") return null;
  return {
    error: "Revisá los campos marcados.",
    fieldErrors: { documentNumber: doc.message ?? "Documento inválido." },
  };
}

function issuesToFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const k = issue.path[0]?.toString();
    if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
  }
  return fieldErrors;
}

export async function createMemberAction(
  _prev: MemberFormState | undefined,
  formData: FormData,
): Promise<MemberFormState> {
  const { workspace, user } = await requireMembersManageContext();
  const parsed = memberSchema.safeParse(formToMemberPayload(formData));
  if (!parsed.success) {
    return { error: "Revisá los campos marcados.", fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  }

  // Alta: siempre se valida, todo el documento es entrada nueva.
  const docError = documentFieldError(parsed.data);
  if (docError) return docError;

  let created;
  try {
    created = await createMember(
      workspace.id,
      memberValuesToRepositoryInput(parsed.data),
      auditActorFrom(user),
    );
  } catch (e) {
    return { error: friendlyMemberError(e) };
  }

  revalidatePath("/members");
  redirect(`/members/${created.id}`);
}

export async function updateMemberAction(
  _prev: MemberFormState | undefined,
  formData: FormData,
): Promise<MemberFormState> {
  const { workspace, user } = await requireMembersManageContext();
  const id = formData.get("id")?.toString()?.trim();
  if (!id) return { error: "Socio inválido." };

  const parsed = memberSchema.safeParse(formToMemberPayload(formData));
  if (!parsed.success) {
    return { error: "Revisá los campos marcados.", fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  }

  // Validación NO retroactiva: solo se exige el formato si el documento cambió respecto del
  // guardado. Así un socio cargado hace años con un formato que hoy no pasaría (el padrón real
  // tiene uno) se puede seguir editando —teléfono, categoría, domicilio— sin quedar bloqueado
  // por un dato que nadie tocó.
  const current = await getMember(workspace.id, id);
  if (!current) return { error: "Socio no encontrado." };

  if (
    documentChanged(
      current.documentType,
      current.documentNumber,
      parsed.data.documentType,
      parsed.data.documentNumber,
    )
  ) {
    const docError = documentFieldError(parsed.data);
    if (docError) return docError;
  }

  // Testigo de concurrencia: el `updatedAt` que el formulario vio al abrirse.
  const expectedRaw = formData.get("expectedUpdatedAt")?.toString()?.trim();
  const expectedUpdatedAt = expectedRaw ? new Date(expectedRaw) : null;

  let updated;
  try {
    updated = await updateMember(workspace.id, id, memberValuesToRepositoryInput(parsed.data), {
      actor: auditActorFrom(user),
      action: "UPDATED",
      expectedUpdatedAt:
        expectedUpdatedAt && !Number.isNaN(expectedUpdatedAt.getTime()) ? expectedUpdatedAt : null,
    });
  } catch (e) {
    if (e instanceof MemberConcurrencyError) {
      return { error: "Otra persona modificó este socio mientras lo editabas. Recargá la ficha e intentá de nuevo." };
    }
    return { error: friendlyMemberError(e) };
  }
  if (!updated) return { error: "Socio no encontrado." };

  revalidatePath("/members");
  revalidatePath(`/members/${id}`);
  revalidatePath(`/members/${id}/edit`);
  redirect(`/members/${id}`);
}

export type ChangeStatusState = { error: string | null };

/** Acción liviana, separada del formulario completo: solo cambia el estado societario. */
export async function changeMemberStatusAction(
  _prev: ChangeStatusState | undefined,
  formData: FormData,
): Promise<ChangeStatusState> {
  const { workspace, user } = await requireMembersManageContext();
  const id = formData.get("id")?.toString()?.trim();
  const status = formData.get("status")?.toString()?.trim() ?? "";
  if (!id) return { error: "Socio inválido." };
  if (!isMemberStatus(status)) return { error: "Estado inválido." };

  // Suspender o dar de baja exige justificar: son las operaciones que le sacan derechos al
  // socio, y el historial no sirve si no dice por qué. Un motivo de solo espacios no cuenta.
  const reason = normalizeReason(formData.get("reason")?.toString());
  if (statusRequiresReason(status) && !reason) {
    return {
      error:
        status === "SUSPENDED"
          ? "Escribí el motivo de la suspensión: queda registrado en el historial del socio."
          : "Escribí el motivo de la baja: queda registrado en el historial del socio.",
    };
  }

  let updated;
  try {
    updated = await updateMember(
      workspace.id,
      id,
      { status, leftAt: status === "INACTIVE" ? new Date() : null },
      { actor: auditActorFrom(user), action: "STATUS_CHANGED", reason },
    );
  } catch (e) {
    if (e instanceof MemberConcurrencyError) {
      return { error: "Otra persona modificó este socio mientras tanto. Recargá la ficha e intentá de nuevo." };
    }
    throw e;
  }
  if (!updated) return { error: "Socio no encontrado." };

  revalidatePath("/members");
  revalidatePath(`/members/${id}`);
  return { error: null };
}

export async function createMemberCategoryAction(
  _prev: MemberFormState | undefined,
  formData: FormData,
): Promise<MemberFormState> {
  const { workspace } = await requireMembersManageContext();
  const parsed = memberCategorySchema.safeParse({
    name: formData.get("name")?.toString()?.trim() ?? "",
    description: formData.get("description")?.toString()?.trim() || null,
    order: Number(formData.get("order")?.toString() ?? 0) || 0,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { error: "Revisá los campos marcados.", fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  }

  try {
    await createMemberCategory(workspace.id, parsed.data);
  } catch (e) {
    return { error: friendlyMemberCategoryError(e) };
  }

  revalidatePath("/members/categories");
  redirect("/members/categories");
}

export async function updateMemberCategoryAction(
  _prev: MemberFormState | undefined,
  formData: FormData,
): Promise<MemberFormState> {
  const { workspace } = await requireMembersManageContext();
  const id = formData.get("id")?.toString()?.trim();
  if (!id) return { error: "Categoría inválida." };

  const parsed = memberCategorySchema.safeParse({
    name: formData.get("name")?.toString()?.trim() ?? "",
    description: formData.get("description")?.toString()?.trim() || null,
    order: Number(formData.get("order")?.toString() ?? 0) || 0,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { error: "Revisá los campos marcados.", fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  }

  let updated;
  try {
    updated = await updateMemberCategory(workspace.id, id, parsed.data);
  } catch (e) {
    return { error: friendlyMemberCategoryError(e) };
  }
  if (!updated) return { error: "Categoría no encontrada." };

  revalidatePath("/members/categories");
  revalidatePath(`/members/categories/${id}/edit`);
  redirect("/members/categories");
}
