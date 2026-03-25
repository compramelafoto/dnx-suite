"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "../lib/auth";
import { resolveActiveOrganizationForUser } from "../lib/fotorank/dashboard-org-context";
import { getContestOrganizationProfileById } from "../lib/fotorank/organizationProfile";

const EDITOR_ROLES = ["OWNER", "ADMIN", "EDITOR"] as const;

function emptyToNull(v: FormDataEntryValue | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export type UpdateInstitutionalProfileResult = { ok: true } | { ok: false; error: string };

export async function updateOrganizationInstitutionalProfile(
  formData: FormData,
): Promise<UpdateInstitutionalProfileResult> {
  const user = await requireAuth();
  const resolved = await resolveActiveOrganizationForUser(user.id);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const orgId = resolved.org.id;

  const member = await prisma.contestOrganizationMember.findFirst({
    where: {
      organizationId: orgId,
      userId: user.id,
      status: "ACTIVE",
      role: { in: [...EDITOR_ROLES] },
    },
  });
  if (!member) return { ok: false, error: "No tenés permiso para editar esta organización." };

  const name = emptyToNull(formData.get("name"));
  if (!name) return { ok: false, error: "El nombre institucional es obligatorio." };

  await prisma.contestOrganization.update({
    where: { id: orgId },
    data: {
      name,
      shortDescription: emptyToNull(formData.get("shortDescription")),
      description: emptyToNull(formData.get("description")),
      logoUrl: emptyToNull(formData.get("logoUrl")),
      coverImageUrl: emptyToNull(formData.get("coverImageUrl")),
      website: emptyToNull(formData.get("website")),
      contactEmail: emptyToNull(formData.get("contactEmail")),
      phone: emptyToNull(formData.get("phone")),
      whatsapp: emptyToNull(formData.get("whatsapp")),
      instagram: emptyToNull(formData.get("instagram")),
      address: emptyToNull(formData.get("address")),
      city: emptyToNull(formData.get("city")),
      country: emptyToNull(formData.get("country")),
    },
  });

  const slugs = await prisma.fotorankContest.findMany({
    where: { organizationId: orgId },
    select: { slug: true },
  });
  for (const { slug } of slugs) {
    revalidatePath(`/concursos/${slug}`);
    revalidatePath(`/concursos/${slug}/jurados`);
  }
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");

  return { ok: true };
}

export async function getActiveOrganizationProfileForSettings() {
  const user = await requireAuth();
  const resolved = await resolveActiveOrganizationForUser(user.id);
  if (!resolved.ok) return { ok: false as const, error: resolved.error, code: resolved.code };
  const profile = await getContestOrganizationProfileById(resolved.org.id);
  if (!profile) return { ok: false as const, error: "Organización no encontrada.", code: "NOT_FOUND" as const };
  return { ok: true as const, profile };
}
