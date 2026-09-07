import { prisma } from "@repo/db";
import { PRINTED_CARD_PERIOD } from "./approve";
import { decimalArsToMinor } from "./money";

export type ApplicationNotice =
  | { kind: "REQUIERE_CONFIRMACION"; institution: string | null }
  | { kind: "FUE_SOCIO"; memberNumber: string; leftAt: Date | null; debtArs: string };

export type InboxItem = {
  id: string;
  fullName: string;
  email: string;
  declaredFeeScale: string;
  categoryName: string | null;
  originInstitution: string | null;
  avatarUrl: string | null;
  documentNumber: string | null;
  noticeAddress: string | null;
  city: string | null;
  phone: string | null;
  /** Presencia profesional declarada. La Secretaría la ve antes de aprobar. */
  businessName: string | null;
  bio: string | null;
  specialties: string[];
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  youtube: string | null;
  linkedin: string | null;
  directoryOptIn: boolean;
  /** Socio que lo recomendó, si entró por su enlace. La Secretaría lo ve antes de aprobar. */
  recommendedBy: { memberNumber: string; fullName: string } | null;
  createdAt: Date;
  notices: ApplicationNotice[];
};

/**
 * Solicitudes pendientes de una institución, con el contexto que la Secretaría necesita
 * para decidir sin salir de la pantalla.
 *
 * Los avisos no son decoración: sin ellos alguien aprobaría una escala reducida sin pedir
 * el certificado, o daría de alta como nuevo a quien ya fue socio y dejó una deuda.
 */
export async function listPendingApplications(workspaceId: string): Promise<InboxItem[]> {
  const solicitudes = await prisma.membershipApplication.findMany({
    where: { workspaceId, status: "PENDIENTE" },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  if (solicitudes.length === 0) return [];

  const categoryIds = [...new Set(solicitudes.map((s) => s.categoryId).filter(Boolean))] as string[];
  const categorias = categoryIds.length
    ? await prisma.memberCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, requiresConfirmation: true },
      })
    : [];
  const porCategoria = new Map(categorias.map((c) => [c.id, c]));

  // Se busca por email y por documento: alguien que vuelve puede haber cambiado de correo.
  const emails = solicitudes.map((s) => s.email);
  const documentos = solicitudes.map((s) => s.documentNumber).filter(Boolean) as string[];
  const previos = await prisma.member.findMany({
    where: {
      workspaceId,
      OR: [
        { email: { in: emails } },
        ...(documentos.length ? [{ documentNumber: { in: documentos } }] : []),
      ],
    },
    select: { id: true, memberNumber: true, email: true, documentNumber: true, leftAt: true },
  });

  /*
    Quién recomendó a cada aspirante. Se muestra antes de aprobar y no después: si el
    vínculo está mal —un enlace compartido de más, una atribución que no corresponde—, este
    es el único momento en que corregirlo no cuesta nada.
  */
  const recomendantesIds = [
    ...new Set(solicitudes.map((s) => s.recommenderMemberId).filter(Boolean)),
  ] as string[];
  const recomendantes = recomendantesIds.length
    ? await prisma.member.findMany({
        where: { id: { in: recomendantesIds } },
        select: { id: true, memberNumber: true, firstName: true, lastName: true },
      })
    : [];
  const porRecomendante = new Map(recomendantes.map((r) => [r.id, r]));

  const deudas = new Map<string, string>();
  if (previos.length) {
    const filas = await prisma.membershipCharge.groupBy({
      by: ["memberId"],
      where: { memberId: { in: previos.map((p) => p.id) } },
      _sum: { balanceArs: true },
    });
    for (const f of filas) deudas.set(f.memberId, (f._sum.balanceArs ?? 0).toString());
  }

  return solicitudes.map((s) => {
    const notices: ApplicationNotice[] = [];

    const cat = s.categoryId ? porCategoria.get(s.categoryId) : null;
    if (cat?.requiresConfirmation || s.declaredFeeScale === "REDUCIDA") {
      notices.push({ kind: "REQUIERE_CONFIRMACION", institution: s.originInstitution });
    }

    const previo = previos.find(
      (p) =>
        p.email?.toLowerCase() === s.email.toLowerCase() ||
        (s.documentNumber && p.documentNumber === s.documentNumber),
    );
    if (previo) {
      notices.push({
        kind: "FUE_SOCIO",
        memberNumber: previo.memberNumber,
        leftAt: previo.leftAt,
        debtArs: deudas.get(previo.id) ?? "0",
      });
    }

    return {
      id: s.id,
      fullName: `${s.firstName} ${s.lastName}`.trim(),
      email: s.email,
      businessName: s.businessName,
      bio: s.bio,
      specialties: s.specialties,
      website: s.website,
      instagram: s.instagram,
      tiktok: s.tiktok,
      facebook: s.facebook,
      youtube: s.youtube,
      linkedin: s.linkedin,
      directoryOptIn: s.directoryOptIn,
      recommendedBy: (() => {
        const r = s.recommenderMemberId ? porRecomendante.get(s.recommenderMemberId) : null;
        if (!r) return null;
        return {
          memberNumber: r.memberNumber,
          fullName: `${r.firstName} ${r.lastName}`.trim(),
        };
      })(),
      declaredFeeScale: s.declaredFeeScale,
      categoryName: cat?.name ?? null,
      originInstitution: s.originInstitution,
      avatarUrl: s.avatarUrl,
      documentNumber: s.documentNumber,
      noticeAddress: s.noticeAddress,
      city: s.city,
      phone: s.phone,
      createdAt: s.createdAt,
      notices,
    };
  });
}

/**
 * Las solicitudes aprobadas que todavía no se pagaron.
 *
 * Este estado existía en la base y no se veía en ninguna pantalla: la Secretaría aprobaba y la
 * solicitud desaparecía de su vista, aunque el ingreso siguiera sin cobrarse. Con el plazo ya
 * en funcionamiento —recordatorio a los siete días y vencimiento al mes— hacía falta poder
 * mirar la lista antes de que las bajas empiecen a ocurrir solas.
 */
export type AwaitingPaymentItem = {
  id: string;
  fullName: string;
  email: string;
  memberId: string;
  memberNumber: string;
  /** Saldo del ingreso, en centavos. */
  pendingMinor: number;
  expiresAt: Date | null;
  /** Si ya activó su cuenta del portal: sin eso no puede pagar. */
  hasAccount: boolean;
};

export async function listAwaitingPayment(workspaceId: string): Promise<AwaitingPaymentItem[]> {
  const solicitudes = await prisma.membershipApplication.findMany({
    where: { workspaceId, status: "APROBADA_IMPAGA", memberId: { not: null } },
    orderBy: { expiresAt: "asc" },
    take: 200,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      memberId: true,
      expiresAt: true,
    },
  });
  if (solicitudes.length === 0) return [];

  const memberIds = solicitudes.map((s) => s.memberId as string);
  const [socios, cargos] = await Promise.all([
    prisma.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, memberNumber: true, userId: true },
    }),
    prisma.membershipCharge.findMany({
      where: {
        memberId: { in: memberIds },
        OR: [{ concept: "INGRESO" }, { concept: "OTRO", period: PRINTED_CARD_PERIOD }],
      },
      select: { memberId: true, balanceArs: true },
    }),
  ]);

  const porSocio = new Map(socios.map((s) => [s.id, s]));
  const saldo = new Map<string, number>();
  for (const c of cargos) {
    saldo.set(c.memberId, (saldo.get(c.memberId) ?? 0) + decimalArsToMinor(c.balanceArs));
  }

  return solicitudes.map((s) => {
    const socio = porSocio.get(s.memberId as string);
    return {
      id: s.id,
      fullName: `${s.firstName} ${s.lastName}`.trim(),
      email: s.email,
      memberId: s.memberId as string,
      memberNumber: socio?.memberNumber ?? "—",
      pendingMinor: saldo.get(s.memberId as string) ?? 0,
      expiresAt: s.expiresAt,
      hasAccount: socio?.userId != null,
    };
  });
}
