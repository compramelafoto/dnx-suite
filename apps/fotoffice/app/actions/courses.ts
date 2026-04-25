"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, Prisma } from "@repo/db";
import { z } from "zod";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { slugify } from "@/lib/slug";

const modality = z.enum(["LIVE", "RECORDED", "HYBRID"]);
const level = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
const status = z.enum(["DRAFT", "PUBLISHED", "PAUSED"]);

const lessonSchema = z.object({
  title: z.string().min(1).max(240),
  summary: z.string().max(4000).optional().nullable(),
});

const sectionSchema = z.object({
  title: z.string().min(1).max(240),
  lessons: z.array(lessonSchema).min(1, "Cada módulo necesita al menos una clase"),
});

const programSchema = z.array(sectionSchema).min(1, "Agregá al menos un módulo al programa");

function emptyToNull(s: string | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

function parseGallery(formData: FormData): string[] {
  const raw = formData.get("galleryImages")?.toString() ?? "";
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function parseFaq(formData: FormData): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  for (let i = 1; i <= 6; i++) {
    const q = formData.get(`faq_q_${i}`)?.toString()?.trim();
    const a = formData.get(`faq_a_${i}`)?.toString()?.trim();
    if (q && a) out.push({ q, a });
  }
  return out;
}

function parseOptionalDate(key: string, formData: FormData): Date | null {
  const v = formData.get(key)?.toString()?.trim();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const baseCourseSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional().nullable(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido"),
  shortDescription: z.string().max(2000).optional().nullable(),
  longDescription: z.string().max(50000).optional().nullable(),
  modality,
  level,
  category: z.string().max(120).optional().nullable(),
  targetAudience: z.string().max(4000).optional().nullable(),
  prerequisites: z.string().max(4000).optional().nullable(),
  objectives: z.string().max(8000).optional().nullable(),
  durationText: z.string().max(200).optional().nullable(),
  scheduleText: z.string().max(500).optional().nullable(),
  seats: z.number().int().min(0).max(1_000_000).nullable(),
  price: z.string().min(1),
  currency: z.string().min(1).max(8),
  discountPrice: z.string().optional().nullable(),
  includesCertificate: z.boolean(),
  includesRecordings: z.boolean(),
  includesDownloadables: z.boolean(),
  coverImageUrl: z.string().max(2000).optional().nullable().or(z.literal("")),
  status,
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(500).optional().nullable(),
  teacherId: z.string().min(1, "Elegí un docente"),
});

export type CourseFormState = { error: string | null; fieldErrors?: Record<string, string> };

function readCourseForm(formData: FormData) {
  const slugRaw = formData.get("slug")?.toString()?.trim();
  const title = formData.get("title")?.toString()?.trim() ?? "";
  const slug = slugRaw || slugify(title);
  return {
    title,
    subtitle: emptyToNull(formData.get("subtitle")?.toString()),
    slug,
    shortDescription: emptyToNull(formData.get("shortDescription")?.toString()),
    longDescription: emptyToNull(formData.get("longDescription")?.toString()),
    modality: formData.get("modality")?.toString(),
    level: formData.get("level")?.toString(),
    category: emptyToNull(formData.get("category")?.toString()),
    targetAudience: emptyToNull(formData.get("targetAudience")?.toString()),
    prerequisites: emptyToNull(formData.get("prerequisites")?.toString()),
    objectives: emptyToNull(formData.get("objectives")?.toString()),
    durationText: emptyToNull(formData.get("durationText")?.toString()),
    scheduleText: emptyToNull(formData.get("scheduleText")?.toString()),
    seats: (() => {
      const s = formData.get("seats")?.toString()?.trim();
      if (!s) return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    })(),
    price: formData.get("price")?.toString()?.trim() ?? "",
    currency: formData.get("currency")?.toString()?.trim() || "ARS",
    discountPrice: emptyToNull(formData.get("discountPrice")?.toString()),
    includesCertificate: formData.get("includesCertificate") === "on",
    includesRecordings: formData.get("includesRecordings") === "on",
    includesDownloadables: formData.get("includesDownloadables") === "on",
    coverImageUrl: emptyToNull(formData.get("coverImageUrl")?.toString()),
    status: formData.get("status")?.toString(),
    seoTitle: emptyToNull(formData.get("seoTitle")?.toString()),
    seoDescription: emptyToNull(formData.get("seoDescription")?.toString()),
    teacherId: formData.get("teacherId")?.toString()?.trim() ?? "",
    sectionsJson: formData.get("sectionsJson")?.toString() ?? "",
  };
}

export async function createCourseAction(
  _prev: CourseFormState | undefined,
  formData: FormData,
): Promise<CourseFormState> {
  const { workspace } = await requireCoursesSalesContext();
  const raw = readCourseForm(formData);
  let sectionsParsed: z.infer<typeof programSchema>;
  try {
    sectionsParsed = programSchema.parse(JSON.parse(raw.sectionsJson || "[]"));
  } catch {
    return { error: "El programa del curso no es válido. Revisá módulos y clases." };
  }

  const base = baseCourseSchema.safeParse({
    ...raw,
    modality: raw.modality,
    level: raw.level,
    status: raw.status,
  });
  if (!base.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of base.error.issues) {
      const k = issue.path[0]?.toString();
      if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: "Revisá los datos del curso.", fieldErrors };
  }
  const d = base.data;

  const teacher = await prisma.courseSalesTeacher.findFirst({
    where: { id: d.teacherId, workspaceId: workspace.id },
  });
  if (!teacher) return { error: "Docente no válido para este workspace." };

  let priceDec: Prisma.Decimal;
  let discountDec: Prisma.Decimal | null = null;
  try {
    priceDec = new Prisma.Decimal(d.price.replace(",", "."));
    if (d.discountPrice) discountDec = new Prisma.Decimal(d.discountPrice.replace(",", "."));
  } catch {
    return { error: "Precio o precio promocional inválido." };
  }

  const startDate = parseOptionalDate("startDate", formData);
  const endDate = parseOptionalDate("endDate", formData);
  const faq = parseFaq(formData);
  const landingBlocksJson: Prisma.InputJsonValue | typeof Prisma.JsonNull =
    faq.length > 0 ? { faq } : Prisma.JsonNull;

  let course;
  try {
    course = await prisma.courseSalesCourse.create({
      data: {
        workspaceId: workspace.id,
        teacherId: d.teacherId,
        title: d.title,
        subtitle: d.subtitle,
        slug: d.slug,
        shortDescription: d.shortDescription,
        longDescription: d.longDescription,
        modality: d.modality,
        level: d.level,
        category: d.category,
        targetAudience: d.targetAudience,
        prerequisites: d.prerequisites,
        objectives: d.objectives,
        durationText: d.durationText,
        scheduleText: d.scheduleText,
        startDate,
        endDate,
        seats: d.seats ?? null,
        price: priceDec,
        currency: d.currency,
        discountPrice: discountDec,
        includesCertificate: d.includesCertificate,
        includesRecordings: d.includesRecordings,
        includesDownloadables: d.includesDownloadables,
        coverImageUrl: d.coverImageUrl,
        galleryImages: parseGallery(formData),
        status: d.status,
        seoTitle: d.seoTitle,
        seoDescription: d.seoDescription,
        landingBlocksJson,
        sections: {
          create: sectionsParsed.map((s, i) => ({
            title: s.title,
            sortOrder: i,
            lessons: {
              create: s.lessons.map((l, j) => ({
                title: l.title,
                summary: l.summary ?? null,
                sortOrder: j,
              })),
            },
          })),
        },
      },
    });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2002") return { error: "Ya existe un curso con ese slug en este workspace." };
    return { error: "No se pudo crear el curso." };
  }
  revalidatePath("/courses");
  redirect(`/courses/${course.id}/edit?created=1`);
}

export async function updateCourseAction(
  _prev: CourseFormState | undefined,
  formData: FormData,
): Promise<CourseFormState> {
  const { workspace } = await requireCoursesSalesContext();
  const id = formData.get("id")?.toString()?.trim();
  if (!id) return { error: "Curso inválido." };
  const existing = await prisma.courseSalesCourse.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) return { error: "Curso no encontrado." };

  const raw = readCourseForm(formData);
  let sectionsParsed: z.infer<typeof programSchema>;
  try {
    sectionsParsed = programSchema.parse(JSON.parse(raw.sectionsJson || "[]"));
  } catch {
    return { error: "El programa del curso no es válido." };
  }

  const base = baseCourseSchema.safeParse({
    ...raw,
    modality: raw.modality,
    level: raw.level,
    status: raw.status,
  });
  if (!base.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of base.error.issues) {
      const k = issue.path[0]?.toString();
      if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: "Revisá los datos del curso.", fieldErrors };
  }
  const d = base.data;

  const teacher = await prisma.courseSalesTeacher.findFirst({
    where: { id: d.teacherId, workspaceId: workspace.id },
  });
  if (!teacher) return { error: "Docente no válido para este workspace." };

  let priceDec: Prisma.Decimal;
  let discountDec: Prisma.Decimal | null = null;
  try {
    priceDec = new Prisma.Decimal(d.price.replace(",", "."));
    if (d.discountPrice) discountDec = new Prisma.Decimal(d.discountPrice.replace(",", "."));
  } catch {
    return { error: "Precio o precio promocional inválido." };
  }

  const startDate = parseOptionalDate("startDate", formData);
  const endDate = parseOptionalDate("endDate", formData);
  const faq = parseFaq(formData);
  const landingBlocksJson: Prisma.InputJsonValue | typeof Prisma.JsonNull =
    faq.length > 0 ? { faq } : Prisma.JsonNull;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.courseSalesSection.deleteMany({ where: { courseId: id } });
      await tx.courseSalesCourse.update({
        where: { id },
        data: {
          teacherId: d.teacherId,
          title: d.title,
          subtitle: d.subtitle,
          slug: d.slug,
          shortDescription: d.shortDescription,
          longDescription: d.longDescription,
          modality: d.modality,
          level: d.level,
          category: d.category,
          targetAudience: d.targetAudience,
          prerequisites: d.prerequisites,
          objectives: d.objectives,
          durationText: d.durationText,
          scheduleText: d.scheduleText,
          startDate,
          endDate,
          seats: d.seats ?? null,
          price: priceDec,
          currency: d.currency,
          discountPrice: discountDec,
          includesCertificate: d.includesCertificate,
          includesRecordings: d.includesRecordings,
          includesDownloadables: d.includesDownloadables,
          coverImageUrl: d.coverImageUrl,
          galleryImages: parseGallery(formData),
          status: d.status,
          seoTitle: d.seoTitle,
          seoDescription: d.seoDescription,
          landingBlocksJson,
          sections: {
            create: sectionsParsed.map((s, i) => ({
              title: s.title,
              sortOrder: i,
              lessons: {
                create: s.lessons.map((l, j) => ({
                  title: l.title,
                  summary: l.summary ?? null,
                  sortOrder: j,
                })),
              },
            })),
          },
        },
      });
    });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2002") return { error: "Ya existe otro curso con ese slug." };
    return { error: "No se pudo actualizar el curso." };
  }

  revalidatePath("/courses");
  revalidatePath(`/courses/${id}/edit`);
  revalidatePath(`/w/`); // landings
  return { error: null };
}
