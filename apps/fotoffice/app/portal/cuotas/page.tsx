import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { loadMemberAccount } from "@/lib/membership/account";
import { formatMinorArs } from "@/lib/membership/money";
import { getWorkspaceCollectionStatus } from "@/lib/payments/connect/status";
import { PayButton } from "./pay-button";

export const dynamic = "force-dynamic";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/** `2026-08` → `agosto de 2026`. Sin `Intl`: el resultado no debe depender del servidor. */
function periodoLegible(period: string): string {
  const [anio, mes] = period.split("-");
  const indice = Number(mes) - 1;
  if (!anio || Number.isNaN(indice) || indice < 0 || indice > 11) return period;
  return `${MESES[indice]} de ${anio}`;
}

function avisoDePago(estado: string | undefined): { tono: "ok" | "warn"; texto: string } | null {
  if (estado === "ok") {
    // No se afirma que ya está acreditado: MercadoPago devuelve al socio antes de que el
    // pago termine de acreditarse, y decir "listo" cuando todavía no lo es sería mentir.
    return {
      tono: "ok",
      texto:
        "Recibimos tu pago. Puede tardar unos minutos en verse acreditado acá; no hace falta que lo pagues de nuevo.",
    };
  }
  if (estado === "pendiente") {
    return {
      tono: "warn",
      texto:
        "Tu pago quedó pendiente. Si elegiste efectivo, se acredita cuando lo abones; puede tardar hasta 48 horas.",
    };
  }
  if (estado === "error") {
    return { tono: "warn", texto: "El pago no se completó. Podés intentarlo de nuevo." };
  }
  return null;
}

export default async function CuotasPage({
  searchParams,
}: {
  searchParams: Promise<{ pago?: string }>;
}) {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");

  const params = await searchParams;
  const aviso = avisoDePago(params.pago);

  const [account, cobros] = await Promise.all([
    loadMemberAccount(context.member.id),
    getWorkspaceCollectionStatus(context.workspace.id),
  ]);

  const alDia = account.charges.length === 0;

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-lg space-y-6 px-4 py-12">
        <div className="space-y-1">
          <Link href="/portal" className="text-xs text-[var(--fo-muted)] hover:underline">
            ← Volver
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Tus cuotas</h1>
          <p className="text-sm text-[var(--fo-muted)]">
            Socio N° {context.member.memberNumber} · {context.workspace.name}
          </p>
        </div>

        {aviso ? (
          <p
            className={`fo-card p-4 text-sm ${
              aviso.tono === "ok" ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"
            }`}
            role="status"
          >
            {aviso.texto}
          </p>
        ) : null}

        {alDia ? (
          <section className="fo-card space-y-2 p-5">
            <h2 className="text-base font-semibold text-[var(--fo-success)]">Estás al día</h2>
            <p className="text-sm text-[var(--fo-muted)]">
              No tenés cuotas pendientes. Gracias por sostener la institución.
            </p>
          </section>
        ) : (
          <>
            <section className="fo-card space-y-3 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold">Lo que debés</h2>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatMinorArs(account.totalDueMinor)}
                </p>
              </div>
              {account.overdueCount > 0 ? (
                <p className="text-xs text-[var(--fo-danger)]">
                  {account.overdueCount === 1
                    ? "Tenés 1 cuota vencida"
                    : `Tenés ${account.overdueCount} cuotas vencidas`}
                  {account.oldestOverduePeriod
                    ? `, la más antigua de ${periodoLegible(account.oldestOverduePeriod)}.`
                    : "."}
                </p>
              ) : null}
            </section>

            <section className="fo-card space-y-3 p-5">
              <h2 className="text-sm font-semibold">Detalle</h2>
              <ul className="divide-y divide-[var(--fo-border)]">
                {account.charges.map((c, i) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="space-y-0.5">
                      <p className="text-sm">{periodoLegible(c.period)}</p>
                      <p className="text-xs text-[var(--fo-muted-soft)]">
                        {c.concept === "INGRESO" ? "Cuota de ingreso" : "Cuota mensual"}
                        {i === 0 && account.charges.length > 1 ? " · la más antigua" : ""}
                      </p>
                    </div>
                    <p className="text-sm font-medium tabular-nums">
                      {formatMinorArs(c.balanceMinor)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            {cobros.canCharge ? (
              <section className="fo-card space-y-3 p-5">
                <h2 className="text-sm font-semibold">Pagar</h2>
                <PayButton
                  howMany="ALL"
                  label={`Pagar todo · ${formatMinorArs(account.totalDueMinor)}`}
                />
                {/*
                  Se ofrece pagar solo la más antigua, no elegir cualquiera: pagar la de
                  agosto dejando junio impaga haría figurar al socio al día y con tres meses
                  de atraso a la vez.
                */}
                {account.charges.length > 1 && account.charges[0] ? (
                  <PayButton
                    howMany="1"
                    label={`Pagar solo la más antigua · ${formatMinorArs(account.charges[0].balanceMinor)}`}
                  />
                ) : null}
                <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
                  El pago va directo a la cuenta de {context.workspace.name}. Se acredita en
                  unos minutos con tarjeta o dinero en cuenta; en efectivo, hasta 48 horas.
                </p>
              </section>
            ) : (
              <section className="fo-card space-y-2 p-5">
                <h2 className="text-sm font-semibold">Pago en línea no disponible</h2>
                <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
                  {context.workspace.name} todavía no habilitó el cobro en línea. Comunicate con
                  la Secretaría para regularizar tu situación.
                </p>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
