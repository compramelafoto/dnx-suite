import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { loadMemberBalance } from "@/lib/membership/balance";
import { CreditCallout } from "@/components/membership/credit-callout";
import { formatMinorArs } from "@/lib/membership/money";
import {
  chargeConceptLabel,
  chargePeriodLabel,
  isOpeningBalance,
} from "@/lib/membership/charge-labels";
import { getWorkspaceCollectionStatus } from "@/lib/payments/connect/status";
import { loadWorkspaceContactChannels } from "@/lib/portal/contact";
import { loadMemberPaymentHistory } from "@/lib/membership/payment-history";
import { PaymentHistoryList } from "@/components/membership/payment-history-list";
import { DuesHelpCard } from "@/components/portal/dues-help-card";
import { PayButton } from "./pay-button";

export const dynamic = "force-dynamic";

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

  const [cuenta, cobros, contacto, pagos] = await Promise.all([
    loadMemberBalance(context.member.id),
    getWorkspaceCollectionStatus(context.workspace.id),
    loadWorkspaceContactChannels(context.workspace.id),
    // Los últimos doce alcanzan para el uso real —comprobar los meses recientes— sin
    // convertir la pantalla en un extracto de años.
    loadMemberPaymentHistory(context.member.id, { limit: 12 }),
  ]);

  const alDia = cuenta.charges.length === 0;

  /*
    El arrastre del sistema anterior se separa de las cuotas.

    Se guarda con el período literal `APERTURA` y el concepto `OTRO`, así que mezclado en la
    misma lista aparecía como «APERTURA · Cuota mensual»: un saldo de hasta $60.000 con el
    rótulo de la cuota del mes. Además esos importes vienen de una migración que no reconcilia
    para todos, y por eso van con su propia advertencia.
  */
  const cuotas = cuenta.charges.filter((c) => !isOpeningBalance(c.period));
  const arrastre = cuenta.charges.filter((c) => isOpeningBalance(c.period));
  const arrastreMinor = arrastre.reduce((s, c) => s + c.balanceMinor, 0);

  const ahora = new Date();
  const cuotasVencidas = cuotas.filter((c) => c.dueDate.getTime() < ahora.getTime());

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
                  {formatMinorArs(cuenta.dueMinor)}
                </p>
              </div>
              {/*
                Se cuentan solo las cuotas: llamar "cuota vencida" al arrastre del sistema
                anterior le sumaba a todo el mundo una cuota que nunca existió como tal.
              */}
              {cuotasVencidas.length > 0 ? (
                <p className="text-xs text-[var(--fo-danger)]">
                  {cuotasVencidas.length === 1
                    ? "Tenés 1 cuota vencida"
                    : `Tenés ${cuotasVencidas.length} cuotas vencidas`}
                  {cuotasVencidas[0]
                    ? `, la más antigua de ${chargePeriodLabel(cuotasVencidas[0].period)}.`
                    : "."}
                </p>
              ) : null}
              {arrastreMinor > 0 ? (
                <p className="text-xs text-[var(--fo-muted)]">
                  Incluye {formatMinorArs(arrastreMinor)} de deuda anterior al sistema.
                </p>
              ) : null}
            </section>

            {cuotas.length > 0 ? (
              <section className="fo-card space-y-3 p-5">
                <h2 className="text-sm font-semibold">Cuotas</h2>
                <ul className="divide-y divide-[var(--fo-border)]">
                  {cuotas.map((c, i) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="space-y-0.5">
                        <p className="text-sm">{chargePeriodLabel(c.period)}</p>
                        <p className="text-xs text-[var(--fo-muted-soft)]">
                          {chargeConceptLabel(c.concept, c.period)}
                          {i === 0 && cuotas.length > 1 ? " · la más antigua" : ""}
                        </p>
                      </div>
                      <p className="text-sm font-medium tabular-nums">
                        {formatMinorArs(c.balanceMinor)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {arrastre.length > 0 ? (
              <section className="fo-card space-y-3 p-5">
                <h2 className="text-sm font-semibold">Deuda anterior al sistema</h2>
                <ul className="divide-y divide-[var(--fo-border)]">
                  {arrastre.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                      <p className="text-xs text-[var(--fo-muted-soft)]">
                        {chargeConceptLabel(c.concept, c.period)}
                      </p>
                      <p className="text-sm font-medium tabular-nums">
                        {formatMinorArs(c.balanceMinor)}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
                  Es el saldo que traías del sistema anterior al 31 de agosto de 2026, antes de
                  que la institución empezara a usar FotoOffice. Si no coincide con tus
                  registros, escribinos y lo revisamos.
                </p>
              </section>
            ) : null}

            {cobros.canCharge ? (
              <section className="fo-card space-y-3 p-5">
                <h2 className="text-sm font-semibold">Pagar</h2>
                <PayButton
                  howMany="ALL"
                  label={`Pagar todo · ${formatMinorArs(cuenta.dueMinor)}`}
                />
                {/*
                  Se ofrece pagar solo la más antigua, no elegir cualquiera: pagar la de
                  agosto dejando junio impaga haría figurar al socio al día y con tres meses
                  de atraso a la vez.
                */}
                {cuenta.charges.length > 1 && cuenta.charges[0] ? (
                  <PayButton
                    howMany="1"
                    label={`Pagar solo la más antigua · ${formatMinorArs(cuenta.charges[0].balanceMinor)}`}
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

        <CreditCallout creditMinor={cuenta.creditMinor} tone="socio" />

        {/*
          Fuera del condicional a propósito, igual que la ayuda de abajo: el socio que está
          al día es justamente el que entra a comprobar que su pago se registró, y hasta
          ahora no tenía nada que mirar.
        */}
        <section className="fo-card space-y-3 p-5">
          <h2 className="text-sm font-semibold">Lo que pagaste</h2>
          <PaymentHistoryList
            entries={pagos}
            emptyText="Todavía no tenemos pagos registrados a tu nombre. Si pagaste y no lo ves acá, escribinos y lo revisamos."
          />
        </section>

        {/*
          Fuera del condicional a propósito: el socio que figura al día también puede estar
          viendo un número que no es el suyo, y es justo el que no tiene dónde reclamar.
        */}
        <DuesHelpCard
          memberNumber={context.member.memberNumber}
          whatsapp={contacto.whatsapp}
          contactEmail={contacto.contactEmail}
        />
      </main>
    </div>
  );
}
