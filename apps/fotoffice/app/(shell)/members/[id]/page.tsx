import Link from "next/link";
import { notFound } from "next/navigation";
import { getMember, listMemberAudits, listMemberInvitations } from "@repo/db/fotoffice-members";
import { prisma } from "@repo/db";
import { requireMembersContext } from "@/lib/members/access";
import { PageHeader } from "@/components/page-header";
import { MemberStatusChanger } from "@/components/members/member-status-changer";
import { MemberAuditLog } from "@/components/members/member-audit-log";
import { formatDocumentForDisplay } from "@/lib/members/documents";
import { MemberAccessPanel } from "@/components/members/member-access-panel";
import { MEMBER_STATUS_LABELS } from "@/lib/members/status-labels";
import { ManualPaymentForm } from "@/components/members/manual-payment-form";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { formatFeeBpsAsPercent } from "@/lib/platform-fee/fee";

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "UTC" }).format(d);
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { workspace, canManage, user } = await requireMembersContext();
  const { id } = await params;
  const member = await getMember(workspace.id, id);
  if (!member) notFound();

  // Solo se consulta si el rol puede verlo: STAFF ni siquiera dispara la query.
  const audits = canManage ? await listMemberAudits(workspace.id, member.id) : [];
  // Solo OWNER/ADMIN gestiona accesos; STAFF ni siquiera dispara estas consultas.
  const invitations = canManage ? await listMemberInvitations(workspace.id, member.id) : [];
  const linkedUser =
    canManage && member.userId
      ? await prisma.user.findUnique({ where: { id: member.userId }, select: { email: true } })
      : null;

  // Registrar un cobro es una atribución de quien maneja la plata, no de quien consulta el
  // padrón: se resuelve con el mismo permiso que gobierna los cobros del workspace.
  const puedeCobrar = await canManageWorkspaceCollection(user.id, workspace.id);
  const feePercent = puedeCobrar
    ? formatFeeBpsAsPercent(await getPlatformFeeBps(workspace.id, MEMBERS_MODULE_KEY))
    : "";

  return (
    <div className="space-y-10">
      <PageHeader
        title={`${member.lastName}, ${member.firstName}`}
        description={`Socio N° ${member.memberNumber}`}
        actions={
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
        }
      />

      <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-start">
        <div
          className="flex size-20 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-2xl font-semibold text-[var(--fo-accent)]"
          aria-hidden
        >
          {initials(member.firstName, member.lastName)}
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <section className="fo-card space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
              Identidad
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--fo-muted)]">Documento</dt>
                <dd className="text-[var(--fo-text)] text-right">
                  {formatDocumentForDisplay(member.documentType, member.documentNumber)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--fo-muted)]">Fecha de nacimiento</dt>
                <dd className="text-[var(--fo-text)]">{fmtDate(member.birthDate)}</dd>
              </div>
            </dl>
          </section>

          <section className="fo-card space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
              Contacto
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--fo-muted)]">Email</dt>
                <dd className="text-[var(--fo-text)] text-right break-all">{member.email ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--fo-muted)]">Teléfono</dt>
                <dd className="text-[var(--fo-text)]">{member.phone ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--fo-muted)]">Dirección</dt>
                <dd className="text-[var(--fo-text)] text-right">
                  {[member.address, member.city, member.province, member.postalCode]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="fo-card space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
              Información societaria
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--fo-muted)]">Número</dt>
                <dd className="text-[var(--fo-text)] font-mono text-xs">{member.memberNumber}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--fo-muted)]">Categoría</dt>
                <dd className="text-[var(--fo-text)]">{member.category?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--fo-muted)]">Fecha de ingreso</dt>
                <dd className="text-[var(--fo-text)]">{fmtDate(member.joinedAt)}</dd>
              </div>
              {member.leftAt ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--fo-muted)]">Fecha de baja</dt>
                  <dd className="text-[var(--fo-text)]">{fmtDate(member.leftAt)}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4 pt-2">
                <dt className="text-[var(--fo-muted)]">Estado</dt>
                <dd>
                  {canManage ? (
                    <MemberStatusChanger memberId={member.id} status={member.status} />
                  ) : (
                    <span className="text-[var(--fo-text)] font-medium">
                      {MEMBER_STATUS_LABELS[member.status]}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="fo-card space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
              Acceso a FotoOffice
            </h2>
            {canManage ? (
              <MemberAccessPanel
                memberId={member.id}
                memberEmail={member.email}
                linkedUserEmail={linkedUser?.email ?? null}
                isLinked={member.userId !== null}
                invitations={invitations}
              />
            ) : (
              <p className="text-sm text-[var(--fo-text)]">
                {member.userId ? "Cuenta vinculada" : "Sin cuenta vinculada"}
              </p>
            )}
          </section>

          {puedeCobrar ? (
            <section className="fo-card space-y-4 sm:col-span-2">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
                  Registrar un pago cobrado en mano
                </h2>
                <p className="text-xs text-[var(--fo-muted)]">
                  Para lo que se cobró en efectivo o por transferencia. Lo que entra por Mercado
                  Pago se acredita solo.
                </p>
              </div>
              <ManualPaymentForm memberId={member.id} feePercent={feePercent} />
            </section>
          ) : null}

          {member.notes ? (
            <section className="fo-card space-y-3 sm:col-span-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
                Observaciones
              </h2>
              <p className="text-sm text-[var(--fo-text)] whitespace-pre-line leading-relaxed">
                {member.notes}
              </p>
            </section>
          ) : null}

          {/* Historial solo para OWNER/ADMIN: incluye motivos de suspensión/baja y quién los
              decidió. STAFF consulta el padrón pero no la trastienda de las decisiones. */}
          {canManage ? (
            <section className="fo-card space-y-4 sm:col-span-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
                Historial
              </h2>
              <MemberAuditLog entries={audits} />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
