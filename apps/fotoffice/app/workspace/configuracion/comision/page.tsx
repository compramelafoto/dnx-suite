import { prisma } from "@repo/db";
import { requireCommissionAdmin } from "@/lib/commission/access";
import { ensureCommissionSetupOnce } from "@/lib/commission/seed";
import { listPendingIntegrants, pendingReasonLabel } from "@/lib/commission/urgent-notice";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { fechaCorta, fechaParaInput, textoMandato } from "./fechas";
import { AvisoUrgente } from "./aviso-urgente";
import { EditarIntegrante, QuitarIntegrante, SumarIntegrante } from "./integrantes-form";
import { historialComision, integrantesVigentes, loadPeriodosComision, type PeriodoComision } from "./personas";

export const dynamic = "force-dynamic";

const ESTADO_FICHA: Record<string, string> = { INACTIVE: "Inactivo", SUSPENDED: "Suspendido" };

/**
 * Integrantes de la Comisión directiva: quién ocupa cada cargo, qué roles tiene y hasta cuándo.
 * Incluye a quienes tienen roles sin cargo (personal, colaboradores) y lo que empieza más adelante.
 */
export default async function IntegrantesPage() {
  const { workspaceId } = await requireCommissionAdmin();
  // El layout también siembra, pero en paralelo con esta página: sin esperar acá, la primera
  // visita podía mostrar las listas vacías. Comparten una sola siembra por pedido.
  await ensureCommissionSetupOnce(workspaceId);
  const now = new Date();

  const [periodos, vocab, offices, roles, socios, pendientes] = await Promise.all([
    loadPeriodosComision(workspaceId),
    loadPersonVocabulary(workspaceId),
    prisma.workspaceOffice.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, votes: true },
    }),
    prisma.workspaceCustomRole.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true, templateKey: true },
    }),
    prisma.member.findMany({
      where: { workspaceId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, memberNumber: true },
    }),
    listPendingIntegrants(workspaceId, now),
  ]);

  const integrantes = integrantesVigentes(periodos, now);
  const historial = historialComision(periodos, now);

  return (
    <div className="space-y-6">
      <SumarIntegrante
        socioWord={vocab.singular}
        socios={socios.map((s) => ({
          id: s.id,
          label: `${`${s.lastName}, ${s.firstName}`.trim()} · N.º ${s.memberNumber}`,
        }))}
        offices={offices}
        roles={roles}
        vocalRoleId={roles.find((r) => r.templateKey === "board-member")?.id ?? null}
      />

      {pendientes.length > 0 ? (
        <AvisoUrgente
          pendientes={pendientes.map((p) => ({
            memberId: p.memberId,
            nombre: p.name,
            motivo: pendingReasonLabel(p),
            bloqueo: p.blocker,
          }))}
        />
      ) : null}

      {integrantes.length === 0 ? (
        <p className="fo-card p-5 text-sm text-[var(--fo-muted)]">
          Todavía no sumaste a nadie a la comisión. Empezá con “Sumar integrante”.
        </p>
      ) : (
        <ul className="space-y-3">
          {integrantes.map((p) => {
            const referencia = p.cargos[0] ?? p.roles[0];
            const empieza = referencia?.startsAt && referencia.startsAt > now ? referencia.startsAt : null;
            const estado = p.estado ? ESTADO_FICHA[p.estado] : undefined;
            return (
              <li key={p.key} className="fo-card space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-[var(--fo-text)]">
                      {p.nombre}
                      {p.numero ? (
                        <span className="ml-2 text-xs font-normal text-[var(--fo-muted)]">N.º {p.numero}</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-[var(--fo-text-secondary)]">
                      {p.cargos.length > 0
                        ? p.cargos.map((c) => `${c.nombre}${c.vota ? "" : " (no vota)"}`).join(" · ")
                        : "Sin cargo"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {!p.memberId ? <Etiqueta>No es {vocab.singular}</Etiqueta> : null}
                    {!p.tieneCuenta ? <Etiqueta tono="warning">Sin cuenta todavía</Etiqueta> : null}
                    {estado ? <Etiqueta tono="danger">{estado}</Etiqueta> : null}
                  </div>
                </div>

                <dl className="grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
                  <dt className="text-[var(--fo-muted)]">Roles</dt>
                  <dd>{p.roles.length > 0 ? p.roles.map((r) => r.nombre).join(", ") : "Ninguno"}</dd>
                  <dt className="text-[var(--fo-muted)]">Mandato</dt>
                  <dd>
                    {empieza ? `desde ${fechaCorta(empieza)}, ` : ""}
                    {textoMandato(referencia?.endsAt ?? null)}
                  </dd>
                </dl>

                <div className="flex flex-wrap gap-2">
                  <EditarIntegrante
                    memberId={p.memberId}
                    userId={p.userId}
                    nombre={p.nombre}
                    roles={roles}
                    rolesActuales={p.roles.map((r) => r.refId)}
                    startsAt={fechaParaInput(referencia?.startsAt ?? null)}
                    endsAt={fechaParaInput(referencia?.endsAt ?? null)}
                  />
                  <QuitarIntegrante memberId={p.memberId} userId={p.userId} nombre={p.nombre} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <details className="fo-card p-4 sm:p-5">
        <summary className="cursor-pointer text-sm font-semibold">
          Historial ({historial.length})
        </summary>
        <p className="mt-2 text-xs text-[var(--fo-muted)]">
          Mandatos y roles que terminaron o se quitaron, lo más reciente primero.
        </p>
        {historial.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--fo-muted)]">Todavía no hay nada en el historial.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--fo-border)]">
            {historial.map((h) => (
              <li key={`${h.tipo}:${h.id}`} className="py-2 text-sm">
                <span className="font-medium">{h.persona.nombre}</span>
                <span className="text-[var(--fo-muted)]"> · {h.tipo === "cargo" ? "Cargo" : "Rol"}: </span>
                {h.nombre}
                <span className="block text-xs text-[var(--fo-muted)]">{textoHistorial(h)}</span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

function textoHistorial(h: PeriodoComision): string {
  const desde = h.startsAt ? `Desde ${fechaCorta(h.startsAt)}. ` : "";
  if (h.revokedAt) return `${desde}Se quitó el ${fechaCorta(h.revokedAt)}.`;
  return `${desde}Venció el ${h.endsAt ? fechaCorta(h.endsAt) : "—"}.`;
}

function Etiqueta({ children, tono }: { children: React.ReactNode; tono?: "warning" | "danger" }) {
  const cls =
    tono === "warning"
      ? "border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]"
      : tono === "danger"
        ? "border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)] text-[var(--fo-danger)]"
        : "border-[var(--fo-border)] bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]";
  return <span className={`rounded-full border px-2 py-0.5 ${cls}`}>{children}</span>;
}
