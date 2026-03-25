"use server";

import { prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "../lib/auth";

function normalizeSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export type CreateOrganizationResult =
  | { ok: true; organizationId: string; slug: string }
  | { ok: false; error: string };

export async function createOrganization(formData: FormData): Promise<CreateOrganizationResult> {
  const user = await requireAuth();

  const name = formData.get("name")?.toString()?.trim();
  const slugRaw = formData.get("slug")?.toString()?.trim();
  const description = formData.get("description")?.toString()?.trim() || null;
  const website = formData.get("website")?.toString()?.trim() || null;
  const logoUrl = formData.get("logoUrl")?.toString()?.trim() || null;

  if (!name) return { ok: false, error: "El nombre es obligatorio." };
  if (!slugRaw) return { ok: false, error: "El slug es obligatorio." };

  const slug = normalizeSlug(slugRaw);
  if (!slug) return { ok: false, error: "El slug no es válido." };

  const existing = await prisma.contestOrganization.findUnique({
    where: { slug },
  });
  if (existing) return { ok: false, error: "Ese slug ya está en uso." };

  const organization = await prisma.contestOrganization.create({
    data: {
      name,
      slug,
      description,
      website,
      logoUrl,
      createdByUserId: user.id,
    },
  });

  await prisma.contestOrganizationMember.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");

  return { ok: true, organizationId: organization.id, slug: organization.slug };
}
