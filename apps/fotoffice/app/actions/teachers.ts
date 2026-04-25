"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { z } from "zod";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { slugify } from "@/lib/slug";

const teacherSchema = z.object({
  firstName: z.string().min(1, "Nombre obligatorio").max(100),
  lastName: z.string().min(1, "Apellido obligatorio").max(100),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: solo minúsculas, números y guiones"),
  shortBio: z.string().max(2000).optional().nullable(),
  longBio: z.string().max(20000).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  whatsapp: z.string().max(200).optional().nullable(),
  instagram: z.string().max(500).optional().nullable(),
  website: z.string().max(500).optional().nullable(),
  specialty: z.string().max(200).optional().nullable(),
  experienceYears: z.number().int().min(0).max(80).nullable(),
  city: z.string().max(120).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  profileImageUrl: z.string().max(2000).optional().nullable().or(z.literal("")),
  isPublished: z.boolean(),
});

function formToTeacherPayload(formData: FormData) {
  const slugRaw = formData.get("slug")?.toString()?.trim();
  const titlePart = `${formData.get("firstName")} ${formData.get("lastName")}`;
  const slug = slugRaw || slugify(titlePart);
  return {
    firstName: formData.get("firstName")?.toString()?.trim() ?? "",
    lastName: formData.get("lastName")?.toString()?.trim() ?? "",
    slug,
    shortBio: emptyToNull(formData.get("shortBio")?.toString()),
    longBio: emptyToNull(formData.get("longBio")?.toString()),
    email: emptyToNull(formData.get("email")?.toString()?.trim()),
    whatsapp: emptyToNull(formData.get("whatsapp")?.toString()?.trim()),
    instagram: emptyToNull(formData.get("instagram")?.toString()?.trim()),
    website: emptyToNull(formData.get("website")?.toString()?.trim()),
    specialty: emptyToNull(formData.get("specialty")?.toString()?.trim()),
    experienceYears: (() => {
      const s = formData.get("experienceYears")?.toString()?.trim();
      if (!s) return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    })(),
    city: emptyToNull(formData.get("city")?.toString()?.trim()),
    country: emptyToNull(formData.get("country")?.toString()?.trim()),
    profileImageUrl: emptyToNull(formData.get("profileImageUrl")?.toString()?.trim()),
    isPublished: formData.get("isPublished") === "on",
  };
}

function emptyToNull(s: string | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

export type TeacherFormState = { error: string | null; fieldErrors?: Record<string, string> };

export async function createTeacherAction(
  _prev: TeacherFormState | undefined,
  formData: FormData,
): Promise<TeacherFormState> {
  const { workspace } = await requireCoursesSalesContext();
  const raw = formToTeacherPayload(formData);
  const parsed = teacherSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0]?.toString();
      if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: "Revisá los campos marcados.", fieldErrors };
  }
  const d = parsed.data;
  const fullName = `${d.firstName} ${d.lastName}`.trim();
  try {
    await prisma.courseSalesTeacher.create({
      data: {
        workspaceId: workspace.id,
        firstName: d.firstName,
        lastName: d.lastName,
        fullName,
        slug: d.slug,
        shortBio: d.shortBio,
        longBio: d.longBio,
        email: d.email,
        whatsapp: d.whatsapp,
        instagram: d.instagram,
        website: d.website,
        specialty: d.specialty,
        experienceYears: d.experienceYears ?? undefined,
        city: d.city,
        country: d.country,
        profileImageUrl: d.profileImageUrl,
        isPublished: d.isPublished,
      },
    });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2002") {
      return { error: "Ya existe un docente con ese slug en este workspace." };
    }
    return { error: "No se pudo crear el docente." };
  }
  revalidatePath("/courses/teachers");
  revalidatePath("/courses");
  return { error: null };
}

export async function updateTeacherAction(
  _prev: TeacherFormState | undefined,
  formData: FormData,
): Promise<TeacherFormState> {
  const { workspace } = await requireCoursesSalesContext();
  const id = formData.get("id")?.toString()?.trim();
  if (!id) return { error: "Docente inválido." };
  const existing = await prisma.courseSalesTeacher.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) return { error: "Docente no encontrado." };

  const raw = formToTeacherPayload(formData);
  const parsed = teacherSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0]?.toString();
      if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: "Revisá los campos marcados.", fieldErrors };
  }
  const d = parsed.data;
  const fullName = `${d.firstName} ${d.lastName}`.trim();
  try {
    await prisma.courseSalesTeacher.update({
      where: { id },
      data: {
        firstName: d.firstName,
        lastName: d.lastName,
        fullName,
        slug: d.slug,
        shortBio: d.shortBio,
        longBio: d.longBio,
        email: d.email,
        whatsapp: d.whatsapp,
        instagram: d.instagram,
        website: d.website,
        specialty: d.specialty,
        experienceYears: d.experienceYears ?? null,
        city: d.city,
        country: d.country,
        profileImageUrl: d.profileImageUrl,
        isPublished: d.isPublished,
      },
    });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2002") {
      return { error: "Ya existe otro docente con ese slug." };
    }
    return { error: "No se pudo actualizar el docente." };
  }
  revalidatePath("/courses/teachers");
  revalidatePath("/courses");
  revalidatePath(`/courses/teachers/${id}/edit`);
  return { error: null };
}
