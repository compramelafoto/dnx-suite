import Link from "next/link";
import { notFound } from "next/navigation";
import { getMember, listMemberInvitations } from "@repo/db/fotoffice-members";
import { prisma } from "@repo/db";
import { requireMembersContext } from "@/lib/members/access";
import { Ficha } from "@/components/ficha/ficha";
import { DatosFicha } from "@/components/ficha/datos-ficha";
import { MasDatos } from "@/components/campos/mas-datos";
import type { InsigniaFicha } from "@/components/ficha/encabezado-ficha";
import { resolverPersonaPorSocio } from "@/lib/ficha/persona";
import { MemberStatusChanger } from "@/components/members/member-status-changer";
import { formatDocumentForDisplay } from "@/lib/members/documents";
import { MemberAccessPanel } from "@/components/members/member-access-panel";
import { MEMBER_STATUS_LABELS } from "@/lib/members/status-labels";
import { ManualPaymentForm } from "@/components/members/manual-payment-form";
import { PaymentHistoryList } from "@/components/membership/payment-history-list";
import { loadMemberPaymentHistory } from "@/lib/membership/payment-history";
import { loadMemberBalance } from "@/lib/membership/balance";
import { CreditCallout } from "@/components/membership/credit-callout";
import { canOperateWorkspaceCollection } from "@/lib/payments/connect/authz";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { formatFeeBpsAsPercent } from "@/lib/platform-fee/fee";
import { canVoidBenefit } from "@/lib/membership/recommendation";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { chargePeriodLabel } from "@/lib/membership/charge-labels";
import { RecommendationVoidForm } from "@/components/members/recommendation-void-form";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "UTC" }).format(d);
}

/**
 * Ficha del socio sobre la ficha estándar. Al centro, notas y línea de tiempo (ahí están
 * ahora las observaciones y el historial de cambios, estado y acceso). A la derecha, las
 * tarjetas de siempre, con los mismos permisos de siempre: `canManage` para cambiar estado,
 * gestionar el acceso, editar y anular bonificaciones; `canOperateWorkspaceCollection` para
 * registrar y ver pagos.
 */
export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { workspace, canManage, user } = await requireMembersContext();
  const { id } = await params;
  const persona = await resolverPersonaPorSocio(workspace.id, id);
  if (!persona) notFound();
  const member = await getMember(workspace.id, id);
  if (!member) notFound();
  const v = await loadPersonVocabulary(workspace.id);

  // Quien opera socios (Dueño, Admin y Equipo) gestiona accesos.
  const invitations = canManage ? await listMemberInvitations(workspace.id, member.id) : [];
  const linkedUser =
    canManage && member.userId
      ? await prisma.user.findUnique({ where: { id: member.userId }, select: { email: true } })
      : null;

  // La ficha de cliente enlazada (si la hay), para ir de una a otra desde el encabezado.
  const clienteVinculado = persona.clientId
    ? await prisma.client.findFirst({
        where: { id: persona.clientId, workspaceId: workspace.id },
        select: { id: true, clientNumber: true },
      })
    : null;

  // Registrar un cobro es una atribución de quien maneja la plata, no de quien consulta el
  // padrón: se resuelve con el mismo permiso que gobierna los cobros del workspace.
  const puedeCobrar = await canOperateWorkspaceCollection(user.id, workspace.id);
  const feePercent = puedeCobrar
    ? formatFeeBpsAsPercent(await getPlatformFeeBps(workspace.id, MEMBERS_MODULE_KEY))
    : "";
  /*
    Las recomendaciones de este socio: quién lo trajo, a quiénes trajo él, y qué bonificó
    cada uno. Se consulta siempre —no sólo para OWNER/ADMIN— porque es información del
    padrón, del mismo orden que la categoría o la fecha de alta.
  */
  const [recomendante, recomendados, bonificaciones] = await Promise.all([
    member.recommendedByMemberId
      ? prisma.member.findUnique({
          where: { id: member.recommendedByMemberId },
          select: { id: true, memberNumber: true, firstName: true, lastName: true },
        })
      : null,
    prisma.member.findMany({
      where: { workspaceId: workspace.id, recommendedByMemberId: member.id },
      select: { id: true, memberNumber: true, firstName: true, lastName: true, joinedAt: true },
      orderBy: { joinedAt: "desc" },
    }),
    prisma.membershipRecommendationBenefit.findMany({
      where: { workspaceId: workspace.id, memberId: member.id },
      select: {
        id: true,
        status: true,
        percent: true,
        appliedAmountArs: true,
        voidReason: true,
        appliedCharge: { select: { period: true, balanceArs: true } },
        originMember: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Quien registra un pago necesita ver, en la misma pantalla, qué se le registró antes:
  // es la única forma de no cargar dos veces el mismo comprobante.
  const pagos = puedeCobrar ? await loadMemberPaymentHistory(member.id, { limit: 50 }) : [];
  const cuenta = puedeCobrar ? await loadMemberBalance(member.id) : null;

  const estado = MEMBER_STATUS_LABELS[member.status];
  const subtitulo = [`${v.Singular} N° ${member.memberNumber}`, estado, member.category?.name]
    .filter(Boolean)
    .join(" · ");
  const insignias: InsigniaFicha[] = clienteVinculado
    ? [{ texto: `Cliente N° ${clienteVinculado.clientNumber}`, href: `/clientes/${clienteVinculado.id}` }]
    : [];

  return (
    <Ficha
      persona={{ tipo: "SOCIO", id: member.id }}
      encabezado={{
        titulo: `${member.lastName}, ${member.firstName}`,
        subtitulo,
        iniciales: initials(member.firstName, member.lastName),
        insignias,
        telefono: member.phone,
        correo: member.email,
        acciones: (
          <>
            <Link href="/members" className="fo-btn fo-btn-secondary text-sm">
              Volver al padrón
            </Link>
            {canManage ? (
              <Link href={`/members/${member.id}/edit`} className="fo-btn fo-btn-primary text-sm">
                Editar
              </Link>
            ) : null}
          </>
        ),
      }}
      datos={
        <>
          <DatosFicha
            titulo="Identidad"
            filas={[
              { etiqueta: "Documento", valor: formatDocumentForDisplay(member.documentType, member.documentNumber) },
              { etiqueta: "Fecha de nacimiento", valor: fmtDate(member.birthDate) },
            ]}
          />
          <DatosFicha
            titulo="Contacto"
            filas={[
              { etiqueta: "Email", valor: member.email ? <span className="break-all">{member.email}</span> : null },
              { etiqueta: "Teléfono", valor: member.phone },
              {
                etiqueta: "Dirección",
                valor: [member.address, member.city, member.province, member.postalCode].filter(Boolean).join(", "),
              },
            ]}
          />
          <DatosFicha
            titulo="Información societaria"
            filas={[
              { etiqueta: "Número", valor: <span className="font-mono text-xs">{member.memberNumber}</span> },
              { etiqueta: "Categoría", valor: member.category?.name },
              { etiqueta: "Fecha de ingreso", valor: fmtDate(member.joinedAt) },
              ...(member.leftAt ? [{ etiqueta: "Fecha de baja", valor: fmtDate(member.leftAt) }] : []),
            ]}
          >
            <div className="flex items-center justify-between gap-4 pt-1 text-sm">
              <span className="text-[var(--fo-muted)]">Estado</span>
              {canManage ? (
                <MemberStatusChanger memberId={member.id} status={member.status} vocabulary={v} />
              ) : (
                <span className="font-medium text-[var(--fo-text)]">{estado}</span>
              )}
            </div>
          </DatosFicha>
          <MasDatos entityType="SOCIO" entityId={member.id} />
        </>
      }
      lateral={
        <>
          <DatosFicha titulo="Acceso a FotoOffice">
            {canManage ? (
              <MemberAccessPanel
                memberId={member.id}
                memberEmail={member.email}
                linkedUserEmail={linkedUser?.email ?? null}
                isLinked={member.userId !== null}
                invitations={invitations}
                vocabulary={v}
              />
            ) : (
              <p className="text-sm text-[var(--fo-text)]">
                {member.userId ? "Cuenta vinculada" : "Sin cuenta vinculada"}
              </p>
            )}
          </DatosFicha>

          {puedeCobrar ? (
            <DatosFicha titulo="Registrar un pago cobrado en mano">
              <p className="text-xs text-[var(--fo-muted)]">
                Para lo que se cobró en efectivo o por transferencia. Lo que entra por Mercado Pago se acredita
                solo.
              </p>
              <ManualPaymentForm memberId={member.id} feePercent={feePercent} />
            </DatosFicha>
          ) : null}

          {puedeCobrar ? (
            <DatosFicha titulo="Pagos">
              <p className="text-xs text-[var(--fo-muted)]">
                {`Es la misma lista que ve el ${v.singular} en su portal. Sólo pagos acreditados.`}
              </p>
              {cuenta ? <CreditCallout creditMinor={cuenta.creditMinor} tone="panel" /> : null}
              <PaymentHistoryList entries={pagos} emptyText={`Este ${v.singular} no tiene pagos acreditados.`} />
            </DatosFicha>
          ) : null}

          {/*
            Recomendaciones. Va en la ficha y no sólo en el portal del socio: la pregunta
            «¿quién lo trajo?» aparece del lado de la Secretaría, cuando hay que revisar una
            atribución o explicar por qué una cuota salió más barata.
          */}
          <DatosFicha titulo="Recomendaciones">
            <p className="text-sm text-[var(--fo-text)]">
              {recomendante ? (
                <>
                  Lo recomendó{" "}
                  <Link href={`/members/${recomendante.id}`} className="hover:underline">
                    N° {recomendante.memberNumber} · {recomendante.firstName} {recomendante.lastName}
                  </Link>
                </>
              ) : (
                <span className="text-[var(--fo-muted)]">Se asoció por su cuenta.</span>
              )}
            </p>

            {recomendados.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-[var(--fo-muted)]">Se asociaron por su recomendación</h3>
                <ul className="divide-y divide-[var(--fo-border)]">
                  {recomendados.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/members/${r.id}`} className="text-sm hover:underline">
                        N° {r.memberNumber} · {r.firstName} {r.lastName}
                      </Link>
                      <span className="text-xs text-[var(--fo-muted-soft)]">{fmtDate(r.joinedAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {bonificaciones.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-[var(--fo-muted)]">Bonificaciones</h3>
                <ul className="divide-y divide-[var(--fo-border)]">
                  {bonificaciones.map((b) => {
                    const saldo = b.appliedCharge ? decimalArsToMinor(b.appliedCharge.balanceArs) : null;
                    const anulable = canVoidBenefit({
                      status: b.status as "PENDIENTE" | "APLICADA" | "ANULADA",
                      appliedChargeBalanceMinor: saldo,
                    });
                    return (
                      <li key={b.id} className="space-y-1.5 py-2.5">
                        <p className="text-sm">
                          {Number(b.percent)}% por {b.originMember.firstName} {b.originMember.lastName}
                        </p>
                        <p className="text-xs text-[var(--fo-muted-soft)]">
                          {b.status === "PENDIENTE"
                            ? "Pendiente: se aplica sobre su próxima cuota."
                            : b.status === "ANULADA"
                              ? `Anulada${b.voidReason ? ` · ${b.voidReason}` : ""}`
                              : `Aplicada a ${chargePeriodLabel(b.appliedCharge?.period ?? "")} · −${formatMinorArs(
                                  b.appliedAmountArs ? decimalArsToMinor(b.appliedAmountArs) : 0,
                                )}`}
                        </p>
                        {canManage && anulable.ok ? (
                          <RecommendationVoidForm benefitId={b.id} memberId={member.id} />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </DatosFicha>
        </>
      }
    />
  );
}
