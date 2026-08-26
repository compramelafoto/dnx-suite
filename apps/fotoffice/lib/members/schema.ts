import { z } from "zod";

/**
 * `categoryId` es obligatorio a nivel de UI/producto (todo socio nuevo se
 * carga con una categoría), aunque el schema de datos lo permite nulo —
 * eso deja espacio para imports futuros que no lo tengan. Ver informe de
 * la etapa de dominio.
 */
export const memberSchema = z.object({
  memberNumber: z.string().min(1, "Número de socio obligatorio").max(50),
  categoryId: z.string().min(1, "Elegí una categoría"),
  firstName: z.string().min(1, "Nombre obligatorio").max(100),
  lastName: z.string().min(1, "Apellido obligatorio").max(100),
  status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]),
  joinedAt: z.string().min(1, "Fecha de ingreso obligatoria"),
  leftAt: z.string().optional().nullable(),
  documentType: z.string().max(40).optional().nullable(),
  documentNumber: z.string().max(60).optional().nullable(),
  email: z.string().email("Email inválido").max(200).optional().nullable().or(z.literal("")),
  phone: z.string().max(60).optional().nullable(),
  birthDate: z.string().optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  province: z.string().max(120).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export type MemberFormValues = z.infer<typeof memberSchema>;

export const memberCategorySchema = z.object({
  name: z.string().min(1, "Nombre obligatorio").max(120),
  description: z.string().max(2000).optional().nullable(),
  order: z.number().int().min(0).max(10000),
  isActive: z.boolean(),
});

export type MemberCategoryFormValues = z.infer<typeof memberCategorySchema>;

function emptyToNull(s: string | undefined | null): string | null {
  const t = s?.trim();
  return t ? t : null;
}

function dateOrNull(s: string | undefined | null): Date | null {
  const t = s?.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formToMemberPayload(formData: FormData) {
  return {
    memberNumber: formData.get("memberNumber")?.toString()?.trim() ?? "",
    categoryId: formData.get("categoryId")?.toString()?.trim() ?? "",
    firstName: formData.get("firstName")?.toString()?.trim() ?? "",
    lastName: formData.get("lastName")?.toString()?.trim() ?? "",
    status: formData.get("status")?.toString()?.trim() ?? "ACTIVE",
    joinedAt: formData.get("joinedAt")?.toString()?.trim() ?? "",
    leftAt: emptyToNull(formData.get("leftAt")?.toString()),
    documentType: emptyToNull(formData.get("documentType")?.toString()),
    documentNumber: emptyToNull(formData.get("documentNumber")?.toString()),
    email: emptyToNull(formData.get("email")?.toString()),
    phone: emptyToNull(formData.get("phone")?.toString()),
    birthDate: emptyToNull(formData.get("birthDate")?.toString()),
    address: emptyToNull(formData.get("address")?.toString()),
    city: emptyToNull(formData.get("city")?.toString()),
    province: emptyToNull(formData.get("province")?.toString()),
    postalCode: emptyToNull(formData.get("postalCode")?.toString()),
    notes: emptyToNull(formData.get("notes")?.toString()),
  };
}

/** Convierte los campos de fecha (string del form) a Date para el repository. */
export function memberValuesToRepositoryInput(d: MemberFormValues) {
  return {
    memberNumber: d.memberNumber,
    categoryId: d.categoryId,
    firstName: d.firstName,
    lastName: d.lastName,
    status: d.status,
    joinedAt: dateOrNull(d.joinedAt) ?? new Date(),
    leftAt: dateOrNull(d.leftAt),
    documentType: d.documentType ?? null,
    documentNumber: d.documentNumber ?? null,
    email: d.email || null,
    phone: d.phone ?? null,
    birthDate: dateOrNull(d.birthDate),
    address: d.address ?? null,
    city: d.city ?? null,
    province: d.province ?? null,
    postalCode: d.postalCode ?? null,
    notes: d.notes ?? null,
  };
}

/** Nunca exponer el error crudo de Prisma al usuario. */
export function friendlyMemberError(e: unknown): string {
  const err = e as { code?: string; meta?: { target?: string[] | string } } | undefined;
  if (err?.code === "P2002") {
    const target = err.meta?.target;
    const t = (Array.isArray(target) ? target.join(",") : String(target ?? "")).toLowerCase();
    if (t.includes("membernumber")) return "Ya existe un socio con ese número en este workspace.";
    if (t.includes("documenttype") || t.includes("documentnumber")) {
      return "Ya existe un socio con ese documento en este workspace.";
    }
    if (t.includes("email")) return "Ya existe un socio con ese email en este workspace.";
    if (t.includes("userid")) return "Esa cuenta ya está vinculada a otro socio de este workspace.";
    return "Ya existe un socio con esos datos en este workspace.";
  }
  return "No se pudo guardar el socio.";
}

export function friendlyMemberCategoryError(e: unknown): string {
  const err = e as { code?: string } | undefined;
  if (err?.code === "P2002") return "Ya existe una categoría con ese nombre en este workspace.";
  return "No se pudo guardar la categoría.";
}
