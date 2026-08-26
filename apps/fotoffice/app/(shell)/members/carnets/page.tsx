import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { loadCardBoard } from "@/lib/carnet/board";
import {
  allowedTransitions,
  capabilityFor,
  FULFILLMENT_STATES,
  stateLabel,
  type FulfillmentState,
} from "@/lib/carnet/fulfillment";
import { canViewCards, resolveCardCapabilities } from "@/lib/carnet/operators";
import { AdvanceForm } from "./advance-form";

export const dynamic = "force-dynamic";

function fechaLegible(d: Date): string {
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}

const TONO: Record<FulfillmentState, string> = {
  PENDIENTE_PAGO: "text-[var(--fo-muted)]",
  EN_COLA: "text-[var(--fo-muted)]",
  IMPRESO: "text-[var(--fo-text)]",
  LISTO_PARA_RETIRAR: "text-[var(--fo-success)]",
  ENVIADO: "text-[var(--fo-success)]",
  ENTREGADO: "text-[var(--fo-success)]",
  ANULADO: "text-[var(--fo-danger)]",
};

/**
 * Tablero de emisión de carnets físicos.
 *
 * Responde en qué punto está cada carnet y quién lo movió. El impresor entra acá, ve lo que
 * tiene para imprimir y marca; la Secretaría ve lo que hay para entregar.
 */
export default async function CarnetsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const capabilities = await resolveCardCapabilities(user.id, workspace.id);
  if (!canViewCards(capabilities)) redirect("/members");

  const params = await searchParams;
  const filtro = FULFILLMENT_STATES.includes(params.estado as FulfillmentState)
    ? (params.estado as FulfillmentState)
    : undefined;

  const board = await loadCardBoard(workspace.id, filtro ? { state: filtro } : {});

  return (
    <div className="space-y-8">
      <PageHeader
        title="Carnets"
        description="En qué punto está cada carnet impreso y quién lo movió."
      />

      <nav className="flex flex-wrap gap-1.5">
        <Link
          href="/members/carnets"
          className={`fo-btn text-xs ${!filtro ? "fo-btn-primary" : ""}`}
        >
          Todos
        </Link>
        {FULFILLMENT_STATES.map((estado) => (
          <Link
            key={estado}
            href={`/members/carnets?estado=${estado}`}
            className={`fo-btn text-xs ${filtro === estado ? "fo-btn-primary" : ""}`}
          >
            {stateLabel(estado)}
            <span className="ml-1.5 tabular-nums opacity-70">{board.counts[estado]}</span>
          </Link>
        ))}
      </nav>

      {board.rows.length === 0 ? (
        <p className="fo-card p-5 text-sm text-[var(--fo-muted)]">
          {filtro
            ? `No hay carnets en «${stateLabel(filtro).toLowerCase()}».`
            : "Todavía no se pidió ninguna tarjeta impresa."}
        </p>
      ) : (
        <ul className="space-y-3">
          {board.rows.map((carnet) => {
            // Solo se ofrecen los pasos que esta persona puede dar: mostrarle al impresor un
            // botón de «entregado» que después se lo rechazan es una promesa vacía.
            const opciones = allowedTransitions(carnet.state).filter((destino) =>
              capabilities.includes(capabilityFor(destino)),
            );
            return (
              <li key={carnet.id} className="fo-card space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <Link
                      href={`/members/${carnet.memberId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {carnet.fullName}
                    </Link>
                    <p className="text-xs text-[var(--fo-muted-soft)]">
                      Socio N° {carnet.memberNumber} · Carnet {carnet.cardNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${TONO[carnet.state]}`}>
                      {stateLabel(carnet.state)}
                    </p>
                    <p className="text-xs text-[var(--fo-muted-soft)]">
                      {carnet.updatedAt
                        ? `${fechaLegible(carnet.updatedAt)}${carnet.lastActorLabel ? ` · ${carnet.lastActorLabel}` : ""}`
                        : `Emitido el ${fechaLegible(carnet.issuedAt)}`}
                    </p>
                  </div>
                </div>

                {carnet.lastNote ? (
                  <p className="text-xs text-[var(--fo-muted)]">{carnet.lastNote}</p>
                ) : null}

                {carnet.noticeError ? (
                  <p className="text-xs text-[var(--fo-danger)]">
                    {/* El paso se dio igual; lo que no salió fue el aviso. */}
                    El aviso al socio no se pudo enviar. El cambio quedó registrado igual.
                  </p>
                ) : null}

                <AdvanceForm cardId={carnet.id} options={[...opciones]} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
