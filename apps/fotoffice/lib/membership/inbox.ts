import { prisma } from "@repo/db";

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
