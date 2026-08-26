"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createMember,
  createMemberCategory,
  updateMember,
  updateMemberCategory,
} from "@repo/db/fotoffice-members";
import { requireMembersManageContext } from "@/lib/members/access";
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
  const { workspace } = await requireMembersManageContext();
  const parsed = memberSchema.safeParse(formToMemberPayload(formData));
  if (!parsed.success) {
    return { error: "Revisá los campos marcados.", fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  }

  let created;
  try {
    created = await createMember(workspace.id, memberValuesToRepositoryInput(parsed.data));
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
  const { workspace } = await requireMembersManageContext();
  const id = formData.get("id")?.toString()?.trim();
  if (!id) return { error: "Socio inválido." };

  const parsed = memberSchema.safeParse(formToMemberPayload(formData));
  if (!parsed.success) {
    return { error: "Revisá los campos marcados.", fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  }

  let updated;
  try {
    updated = await updateMember(workspace.id, id, memberValuesToRepositoryInput(parsed.data));
  } catch (e) {
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
  const { workspace } = await requireMembersManageContext();
  const id = formData.get("id")?.toString()?.trim();
  const status = formData.get("status")?.toString()?.trim() ?? "";
  if (!id) return { error: "Socio inválido." };
  if (!isMemberStatus(status)) return { error: "Estado inválido." };

  const updated = await updateMember(workspace.id, id, {
    status,
    leftAt: status === "INACTIVE" ? new Date() : null,
  });
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
