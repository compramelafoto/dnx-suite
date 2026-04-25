"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, prisma } from "@repo/db";
import { z } from "zod";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { slugify } from "@/lib/slug";
import { logCourseEvent } from "@/lib/presential-courses/log";
import {
  computeAvailableSpots,
  getApprovedEnrollmentCountsByInstanceIds,
} from "@/lib/presential-courses/availability";

const courseStatusSchema = z.enum(["DRAFT", "PUBLISHED", "UPCOMING", "HIDDEN"]);
const courseSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  shortDescription: z.string().max(2000).optional().nullable(),
  longDescription: z.string().max(50000).optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable().or(z.literal("")),
  thumbnailImageUrl: z.string().url().optional().nullable().or(z.literal("")),
  instructorName: z.string().max(160).optional().nullable(),
  level: z.string().max(80).optional().nullable(),
  status: courseStatusSchema.default("DRAFT"),
  classroomLink: z.string().url().optional().nullable().or(z.literal("")),
  classroomCode: z.string().max(200).optional().nullable(),
  classroomInstructions: z.string().max(5000).optional().nullable(),
  faqJson: z.unknown().optional().nullable(),
});

const courseInstanceStatusSchema = z.enum(["ACTIVE", "FULL", "CANCELLED"]);
const courseInstanceSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().max(180).optional().nullable(),
  startDateTime: z.coerce.date(),
  endDateTime: z.coerce.date(),
  locationName: z.string().min(1).max(220),
  locationAddress: z.string().max(500).optional().nullable(),
  priceArs: z.coerce.number().min(0),
  capacity: z.coerce.number().int().min(1).max(100000),
  status: courseInstanceStatusSchema.default("ACTIVE"),
});
const updateCourseInstanceSchema = courseInstanceSchema.extend({
  instanceId: z.string().min(1),
});

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseFaqJson(raw: string | null | undefined) {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return null;
    return parsed.slice(0, 20);
  } catch {
    return null;
  }
}

function normalizeSlug(inputSlug: string | undefined, title: string) {
  const fromInput = inputSlug?.trim();
  const candidate = fromInput || slugify(title);
  if (!candidate) {
    throw new Error("No se pudo generar slug para el curso.");
  }
  return candidate;
}

function normalizeCourseInput(input: z.input<typeof courseSchema>) {
  const parsed = courseSchema.parse(input);
  const slug = normalizeSlug(parsed.slug, parsed.title);
  const faqJson =
    parsed.faqJson === undefined
      ? undefined
      : parsed.faqJson === null
        ? Prisma.JsonNull
        : (parsed.faqJson as Prisma.InputJsonValue);
  return {
    title: parsed.title.trim(),
    slug,
    shortDescription: emptyToNull(parsed.shortDescription ?? undefined),
    longDescription: emptyToNull(parsed.longDescription ?? undefined),
    coverImageUrl: emptyToNull(parsed.coverImageUrl ?? undefined),
    thumbnailImageUrl: emptyToNull(parsed.thumbnailImageUrl ?? undefined),
    instructorName: emptyToNull(parsed.instructorName ?? undefined),
    level: emptyToNull(parsed.level ?? undefined),
    status: parsed.status,
    classroomLink: emptyToNull(parsed.classroomLink ?? undefined),
    classroomCode: emptyToNull(parsed.classroomCode ?? undefined),
    classroomInstructions: emptyToNull(parsed.classroomInstructions ?? undefined),
    faqJson,
  };
}

async function assertWorkspaceCourse(workspaceId: string, courseId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, workspaceId },
    select: { id: true, workspaceId: true },
  });
  if (!course) {
    throw new Error("Curso no encontrado para este workspace.");
  }
  return course;
}

async function assertWorkspaceCourseInstance(
  workspaceId: string,
  courseId: string,
  instanceId: string,
) {
  await assertWorkspaceCourse(workspaceId, courseId);
  const instance = await prisma.courseInstance.findFirst({
    where: { id: instanceId, courseId, course: { workspaceId } },
    select: { id: true },
  });
  if (!instance) {
    throw new Error("Edición no encontrada para este curso/workspace.");
  }
  return instance;
}

export async function listWorkspaceCourses() {
  const { workspace } = await requireCoursesSalesContext();
  const courses = await prisma.course.findMany({
    where: { workspaceId: workspace.id },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          instances: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  const approvedCounts = await prisma.courseEnrollment.groupBy({
    by: ["courseId"],
    where: {
      workspaceId: workspace.id,
      paymentStatus: "APPROVED",
    },
    _count: { _all: true },
  });
  const approvedMap = new Map(approvedCounts.map((row) => [row.courseId, row._count._all]));
  return courses.map((course) => ({
    ...course,
    approvedEnrollments: approvedMap.get(course.id) ?? 0,
  }));
}

export async function createCourse(input: z.input<typeof courseSchema>) {
  const { workspace } = await requireCoursesSalesContext();
  const data = normalizeCourseInput(input);
  try {
    const created = await prisma.course.create({
      data: {
        workspaceId: workspace.id,
        ...data,
      },
      select: { id: true, slug: true, status: true },
    });
    logCourseEvent("course_created", { workspaceId: workspace.id, courseId: created.id });
    return created;
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code: string }).code : "";
    if (code === "P2002") throw new Error("Ya existe un curso con ese slug en este workspace.");
    throw error;
  }
}

export async function updateCourse(courseId: string, input: z.input<typeof courseSchema>) {
  const { workspace } = await requireCoursesSalesContext();
  if (!courseId?.trim()) throw new Error("courseId es obligatorio.");
  await assertWorkspaceCourse(workspace.id, courseId);
  const data = normalizeCourseInput(input);
  try {
    const updated = await prisma.course.update({
      where: { id: courseId },
      data: {
        ...data,
      },
      select: { id: true, slug: true, status: true },
    });
    logCourseEvent("course_updated", { workspaceId: workspace.id, courseId });
    return updated;
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code: string }).code : "";
    if (code === "P2002") throw new Error("Ya existe otro curso con ese slug en este workspace.");
    throw error;
  }
}

export async function duplicateCourse(courseId: string) {
  const { workspace } = await requireCoursesSalesContext();
  if (!courseId?.trim()) throw new Error("courseId es obligatorio.");
  const source = await prisma.course.findFirst({
    where: { id: courseId, workspaceId: workspace.id },
  });
  if (!source) throw new Error("Curso no encontrado.");

  const slugBase = slugify(`copia-${source.slug}`) || `copia-${source.id.slice(0, 8)}`;
  let slugCandidate = slugBase;
  let suffix = 2;
  while (await prisma.course.findFirst({ where: { workspaceId: workspace.id, slug: slugCandidate } })) {
    slugCandidate = `${slugBase}-${suffix}`;
    suffix += 1;
  }

  const clone = await prisma.course.create({
    data: {
      workspaceId: workspace.id,
      title: `Copia de ${source.title}`,
      slug: slugCandidate,
      shortDescription: source.shortDescription,
      longDescription: source.longDescription,
      coverImageUrl: source.coverImageUrl,
      thumbnailImageUrl: source.thumbnailImageUrl,
      instructorName: source.instructorName,
      level: source.level,
      faqJson:
        source.faqJson === null
          ? Prisma.JsonNull
          : (source.faqJson as Prisma.InputJsonValue),
      classroomLink: source.classroomLink,
      classroomCode: source.classroomCode,
      classroomInstructions: source.classroomInstructions,
      status: "DRAFT",
    },
    select: { id: true },
  });
  logCourseEvent("course_duplicated", {
    workspaceId: workspace.id,
    sourceCourseId: source.id,
    targetCourseId: clone.id,
  });
  return clone;
}

export async function getCourseForEdit(courseId: string) {
  const { workspace } = await requireCoursesSalesContext();
  if (!courseId?.trim()) throw new Error("courseId es obligatorio.");
  const course = await prisma.course.findFirst({
    where: { id: courseId, workspaceId: workspace.id },
  });
  if (!course) throw new Error("Curso no encontrado.");
  return course;
}

type CourseInstanceInput = z.input<typeof courseInstanceSchema>;
type UpdateCourseInstanceInput = z.input<typeof updateCourseInstanceSchema>;

function ensureInstanceDateRange(startDateTime: Date, endDateTime: Date) {
  if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(endDateTime.getTime())) {
    throw new Error("Fecha/hora inválida.");
  }
  if (startDateTime >= endDateTime) {
    throw new Error("startDateTime debe ser menor que endDateTime.");
  }
}

export async function createCourseInstance(input: CourseInstanceInput) {
  const { workspace } = await requireCoursesSalesContext();
  const parsed = courseInstanceSchema.parse(input);
  await assertWorkspaceCourse(workspace.id, parsed.courseId);
  ensureInstanceDateRange(parsed.startDateTime, parsed.endDateTime);

  const created = await prisma.courseInstance.create({
    data: {
      courseId: parsed.courseId,
      title: emptyToNull(parsed.title ?? undefined),
      startDateTime: parsed.startDateTime,
      endDateTime: parsed.endDateTime,
      locationName: parsed.locationName.trim(),
      locationAddress: emptyToNull(parsed.locationAddress ?? undefined),
      priceArs: parsed.priceArs,
      capacity: parsed.capacity,
      status: parsed.status,
    },
  });
  logCourseEvent("instance_created", {
    workspaceId: workspace.id,
    courseId: parsed.courseId,
    instanceId: created.id,
  });
  return created;
}

export async function updateCourseInstance(input: UpdateCourseInstanceInput) {
  const { workspace } = await requireCoursesSalesContext();
  const parsed = updateCourseInstanceSchema.parse(input);
  await assertWorkspaceCourseInstance(workspace.id, parsed.courseId, parsed.instanceId);
  ensureInstanceDateRange(parsed.startDateTime, parsed.endDateTime);

  const updated = await prisma.courseInstance.update({
    where: { id: parsed.instanceId },
    data: {
      title: emptyToNull(parsed.title ?? undefined),
      startDateTime: parsed.startDateTime,
      endDateTime: parsed.endDateTime,
      locationName: parsed.locationName.trim(),
      locationAddress: emptyToNull(parsed.locationAddress ?? undefined),
      priceArs: parsed.priceArs,
      capacity: parsed.capacity,
      status: parsed.status,
    },
  });
  logCourseEvent("instance_updated", {
    workspaceId: workspace.id,
    courseId: parsed.courseId,
    instanceId: parsed.instanceId,
  });
  return updated;
}

export async function listCourseInstances(courseId: string) {
  const { workspace } = await requireCoursesSalesContext();
  if (!courseId?.trim()) throw new Error("courseId es obligatorio.");
  await assertWorkspaceCourse(workspace.id, courseId);
  return prisma.courseInstance.findMany({
    where: { courseId },
    orderBy: { startDateTime: "asc" },
  });
}

export async function getCourseInstancesWithAvailability(courseId: string) {
  const instances = await listCourseInstances(courseId);
  const approvedByInstance = await getApprovedEnrollmentCountsByInstanceIds(instances.map((i) => i.id));
  return instances.map((instance) => {
    const approvedEnrollments = approvedByInstance.get(instance.id) ?? 0;
    const availableSpots = computeAvailableSpots(instance.capacity, approvedEnrollments);
    return {
      ...instance,
      approvedEnrollments,
      availableSpots,
    };
  });
}

export type PresentialCourseActionState = { error: string | null; ok?: boolean };

/**
 * Wrappers legacy (FormData) para no romper integraciones existentes.
 * Internamente delegan en la API tipada de este módulo.
 */
export async function createPresentialCourseAction(
  _prev: PresentialCourseActionState | undefined,
  formData: FormData,
): Promise<PresentialCourseActionState> {
  try {
    const created = await createCourse({
      title: formData.get("title")?.toString()?.trim() ?? "",
      slug: formData.get("slug")?.toString()?.trim(),
      shortDescription: emptyToNull(formData.get("shortDescription")?.toString()),
      longDescription: emptyToNull(formData.get("longDescription")?.toString()),
      coverImageUrl: emptyToNull(formData.get("coverImageUrl")?.toString()),
      thumbnailImageUrl: emptyToNull(formData.get("thumbnailImageUrl")?.toString()),
      instructorName: emptyToNull(formData.get("instructorName")?.toString()),
      level: emptyToNull(formData.get("level")?.toString()),
      status: (formData.get("status")?.toString() as z.infer<typeof courseStatusSchema>) ?? "DRAFT",
      classroomLink: emptyToNull(formData.get("classroomLink")?.toString()),
      classroomCode: emptyToNull(formData.get("classroomCode")?.toString()),
      classroomInstructions: emptyToNull(formData.get("classroomInstructions")?.toString()),
      faqJson: parseFaqJson(formData.get("faqJson")?.toString()),
    });
    revalidatePath("/dashboard/courses");
    redirect(`/dashboard/courses/${created.id}`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el curso." };
  }
}

export async function updatePresentialCourseAction(
  _prev: PresentialCourseActionState | undefined,
  formData: FormData,
): Promise<PresentialCourseActionState> {
  try {
    const id = formData.get("id")?.toString()?.trim();
    if (!id) return { error: "Curso inválido." };
    await updateCourse(id, {
      title: formData.get("title")?.toString()?.trim() ?? "",
      slug: formData.get("slug")?.toString()?.trim(),
      shortDescription: emptyToNull(formData.get("shortDescription")?.toString()),
      longDescription: emptyToNull(formData.get("longDescription")?.toString()),
      coverImageUrl: emptyToNull(formData.get("coverImageUrl")?.toString()),
      thumbnailImageUrl: emptyToNull(formData.get("thumbnailImageUrl")?.toString()),
      instructorName: emptyToNull(formData.get("instructorName")?.toString()),
      level: emptyToNull(formData.get("level")?.toString()),
      status: (formData.get("status")?.toString() as z.infer<typeof courseStatusSchema>) ?? "DRAFT",
      classroomLink: emptyToNull(formData.get("classroomLink")?.toString()),
      classroomCode: emptyToNull(formData.get("classroomCode")?.toString()),
      classroomInstructions: emptyToNull(formData.get("classroomInstructions")?.toString()),
      faqJson: parseFaqJson(formData.get("faqJson")?.toString()),
    });
    revalidatePath("/dashboard/courses");
    revalidatePath(`/dashboard/courses/${id}`);
    return { error: null, ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el curso." };
  }
}

export async function duplicatePresentialCourseAction(courseId: string) {
  try {
    await duplicateCourse(courseId);
    revalidatePath("/dashboard/courses");
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo duplicar el curso." };
  }
}

export async function createCourseInstanceAction(
  _prev: PresentialCourseActionState | undefined,
  formData: FormData,
): Promise<PresentialCourseActionState> {
  try {
    const startDateTimeRaw = formData.get("startDateTime")?.toString() ?? "";
    const endDateTimeRaw = formData.get("endDateTime")?.toString() ?? "";
    const priceArs = Number(formData.get("priceArs")?.toString() ?? "0");
    const capacity = Number(formData.get("capacity")?.toString() ?? "0");
    await createCourseInstance({
      courseId: formData.get("courseId")?.toString()?.trim() ?? "",
      title: emptyToNull(formData.get("title")?.toString()),
      startDateTime: new Date(startDateTimeRaw),
      endDateTime: new Date(endDateTimeRaw),
      locationName: formData.get("locationName")?.toString()?.trim() ?? "",
      locationAddress: emptyToNull(formData.get("locationAddress")?.toString()),
      priceArs,
      capacity,
      status: (formData.get("status")?.toString() as z.infer<typeof courseInstanceStatusSchema>) ?? "ACTIVE",
    });
    const courseId = formData.get("courseId")?.toString()?.trim();
    if (courseId) {
      revalidatePath(`/dashboard/courses/${courseId}`);
    }
    return { error: null, ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la edición." };
  }
}

export async function updateCourseInstanceAction(
  _prev: PresentialCourseActionState | undefined,
  formData: FormData,
): Promise<PresentialCourseActionState> {
  try {
    const startDateTimeRaw = formData.get("startDateTime")?.toString() ?? "";
    const endDateTimeRaw = formData.get("endDateTime")?.toString() ?? "";
    const priceArs = Number(formData.get("priceArs")?.toString() ?? "0");
    const capacity = Number(formData.get("capacity")?.toString() ?? "0");
    await updateCourseInstance({
      instanceId: formData.get("instanceId")?.toString()?.trim() ?? "",
      courseId: formData.get("courseId")?.toString()?.trim() ?? "",
      title: emptyToNull(formData.get("title")?.toString()),
      startDateTime: new Date(startDateTimeRaw),
      endDateTime: new Date(endDateTimeRaw),
      locationName: formData.get("locationName")?.toString()?.trim() ?? "",
      locationAddress: emptyToNull(formData.get("locationAddress")?.toString()),
      priceArs,
      capacity,
      status: (formData.get("status")?.toString() as z.infer<typeof courseInstanceStatusSchema>) ?? "ACTIVE",
    });
    const courseId = formData.get("courseId")?.toString()?.trim();
    if (courseId) {
      revalidatePath(`/dashboard/courses/${courseId}`);
    }
    return { error: null, ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar la edición." };
  }
}
