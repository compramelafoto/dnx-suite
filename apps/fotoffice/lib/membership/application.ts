import { Prisma } from "@repo/db";
import { z } from "zod";
import {
  normalizarSitioWeb,
  normalizarUrlRed,
  normalizarUsuarioRed,
  type RedPorUrl,
  type RedPorUsuario,
} from "./social";
import { parsearEspecialidades, type EspecialidadId } from "./specialties";

/**
 * Escalas que una persona puede **declarar** al asociarse.
 *
 * `EXENTA` no está: la exención la otorga la institución (honorario, jubilado), no se
 * autodeclara. Quien la eligiera estaría pidiendo no pagar por decisión propia.
 */
const DECLARABLE_SCALES = ["PLENA", "REDUCIDA"] as const;

const texto = (max: number) => z.string().trim().max(max);

const schema = z
  .object({
    firstName: texto(120).min(1, "Falta el nombre."),
    lastName: texto(120).min(1, "Falta el apellido."),
    documentType: texto(24).optional().nullable(),
    documentNumber: texto(32).optional().nullable(),
    taxId: texto(24).optional().nullable(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("El email no parece válido."),
    phone: texto(40).optional().nullable(),
    /**
     * Domicilio de notificaciones. Obligatorio: sin él no se puede cursar una intimación,
     * y sin intimación la baja por deuda es nula. Pedirlo dos años después, con el socio ya
     * en deuda, es impracticable.
     */
    noticeAddress: texto(240).min(1, "Falta el domicilio de notificaciones."),
    city: texto(120).optional().nullable(),
    province: texto(120).optional().nullable(),
    postalCode: texto(20).optional().nullable(),
    declaredFeeScale: z.enum(DECLARABLE_SCALES, {
      errorMap: () => ({ message: "Elegí una condición válida." }),
    }),
    originInstitution: texto(200).optional().nullable(),
    ownDuesAmount: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine((v) => !v || /^\d+([.,]\d{1,2})?$/.test(v), "El monto no parece válido.")
      .refine((v) => !v || Number(v.replace(",", ".")) > 0, "El monto debe ser mayor a cero."),
    /**
     * Fecha de nacimiento. Opcional: no todo el mundo la tiene a mano al asociarse y no vale
     * la pena perder una solicitud por eso. Se validan los extremos porque el padrón migrado
     * ya trajo fechas imposibles —alguien asociándose a los 5 años— y conviene cortarlas acá.
     */
    birthDate: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "La fecha de nacimiento no es válida.")
      .refine((v) => {
        if (!v) return true;
        const d = new Date(`${v}T00:00:00.000Z`);
        if (Number.isNaN(d.getTime())) return false;
        const anio = d.getUTCFullYear();
        return anio >= 1900 && d.getTime() <= Date.now();
      }, "Revisá la fecha de nacimiento."),
    avatarUrl: texto(600).optional().nullable(),
    /**
     * Presencia profesional. Todo opcional: nadie deja de asociarse por no tener Instagram,
     * y una solicitud perdida cuesta más que un dato faltante.
     */
    businessName: texto(160).optional().nullable(),
    bio: texto(600).optional().nullable(),
    website: texto(500).optional().nullable(),
    instagram: texto(200).optional().nullable(),
    tiktok: texto(200).optional().nullable(),
    facebook: texto(500).optional().nullable(),
    youtube: texto(500).optional().nullable(),
    linkedin: texto(500).optional().nullable(),
    /** Llegan varios valores con el mismo nombre desde el formulario. */
    specialties: z
      .union([z.array(z.string()), z.string()])
      .optional()
      .nullable()
      .transform((v) => (v == null ? [] : Array.isArray(v) ? v : [v])),
    directoryOptIn: z
      .union([z.boolean(), z.string()])
      .optional()
      .nullable()
      .transform((v) => v === true || v === "on" || v === "true"),
    presenterMemberId: texto(64).optional().nullable(),
    /** Un checkbox llega como "on"; desde código puede llegar como booleano. */
    wantsPrintedCard: z
      .union([z.boolean(), z.string()])
      .optional()
      .nullable()
      .transform((v) => v === true || v === "on" || v === "true"),
  })
  .refine(
    (d) => d.declaredFeeScale !== "REDUCIDA" || Boolean(d.originInstitution?.trim()),
    { message: "Decinos de qué institución sos estudiante.", path: ["originInstitution"] },
  );

export type ParsedApplication = {
  firstName: string;
  lastName: string;
  documentType: string | null;
  documentNumber: string | null;
  taxId: string | null;
  email: string;
  phone: string | null;
  noticeAddress: string;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  declaredFeeScale: (typeof DECLARABLE_SCALES)[number];
  originInstitution: string | null;
  ownDuesAmount: Prisma.Decimal | null;
  birthDate: Date | null;
  avatarUrl: string | null;
  presenterMemberId: string | null;
  wantsPrintedCard: boolean;
  businessName: string | null;
  bio: string | null;
  specialties: EspecialidadId[];
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  youtube: string | null;
  linkedin: string | null;
  directoryOptIn: boolean;
};

export type ParseResult =
  | { ok: true; data: ParsedApplication }
  | { ok: false; error: string; field?: string };

function nulo(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/**
 * Valida y normaliza una solicitud de asociación.
 *
 * Devuelve un resultado en vez de lanzar: el formulario público necesita mostrar el error
 * a la persona, no un error de servidor.
 */
export function parseApplication(raw: unknown): ParseResult {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "Datos inválidos.",
      field: issue?.path?.[0] ? String(issue.path[0]) : undefined,
    };
  }

  const d = parsed.data;

  /**
   * Las redes se normalizan después de zod porque no alcanza con validar el formato: hay que
   * transformar lo pegado en un valor canónico, y cuando falla el mensaje tiene que señalar
   * el campo exacto para que el formulario lo marque.
   */
  const redes: Record<string, string | null> = {};
  for (const red of ["instagram", "tiktok"] as RedPorUsuario[]) {
    const r = normalizarUsuarioRed(red, d[red]);
    if (!r.ok) return { ok: false, error: r.error, field: red };
    redes[red] = r.valor;
  }
  for (const red of ["facebook", "youtube", "linkedin"] as RedPorUrl[]) {
    const r = normalizarUrlRed(red, d[red]);
    if (!r.ok) return { ok: false, error: r.error, field: red };
    redes[red] = r.valor;
  }
  const web = normalizarSitioWeb(d.website);
  if (!web.ok) return { ok: false, error: web.error, field: "website" };

  const rubros = parsearEspecialidades(d.specialties);
  if (!rubros.ok) return { ok: false, error: rubros.error, field: "specialties" };

  return {
    ok: true,
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      documentType: nulo(d.documentType),
      documentNumber: nulo(d.documentNumber),
      taxId: nulo(d.taxId),
      email: d.email,
      phone: nulo(d.phone),
      noticeAddress: d.noticeAddress,
      city: nulo(d.city),
      province: nulo(d.province),
      postalCode: nulo(d.postalCode),
      declaredFeeScale: d.declaredFeeScale,
      originInstitution: nulo(d.originInstitution),
      ownDuesAmount: d.ownDuesAmount
        ? new Prisma.Decimal(d.ownDuesAmount.replace(",", "."))
        : null,
      birthDate: d.birthDate ? new Date(`${d.birthDate}T00:00:00.000Z`) : null,
      avatarUrl: nulo(d.avatarUrl),
      presenterMemberId: nulo(d.presenterMemberId),
      wantsPrintedCard: d.wantsPrintedCard,
      businessName: nulo(d.businessName),
      bio: nulo(d.bio),
      specialties: rubros.valor,
      website: web.valor,
      instagram: redes.instagram ?? null,
      tiktok: redes.tiktok ?? null,
      facebook: redes.facebook ?? null,
      youtube: redes.youtube ?? null,
      linkedin: redes.linkedin ?? null,
      directoryOptIn: d.directoryOptIn,
    },
  };
}
