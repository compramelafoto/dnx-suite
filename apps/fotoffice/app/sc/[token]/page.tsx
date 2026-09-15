import type { Metadata } from "next";
import { fechaHoraArgentina } from "@/lib/coverages/format";
import { findByTrackingToken } from "@/lib/coverages/repository";
import { requestStatusLabel } from "@/lib/coverages/states";
import { resolveTrackingView } from "@/lib/coverages/tracking-view";
import { ResponderForm } from "./responder-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seguimiento de tu pedido",
  // Un enlace privado no se indexa. Es una credencial, no una página.
  robots: { index: false, follow: false },
};

/**
 * La ventana de la organización a su propio pedido.
 *
 * Sin cuenta: el token del enlace es la credencial. Muestra en qué anda, qué se le pidió si se
 * le pidió algo, y nada más — ni notas internas, ni quién lo está evaluando, ni datos de otros
 * pedidos.
 *
 * Un enlace inexistente y uno vencido muestran el MISMO mensaje: confirmarle a alguien que un
 * token existió pero caducó le dice que acertó a adivinarlo.
 */
export default async function SeguimientoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const solicitud = await findByTrackingToken(token);
  const vista = resolveTrackingView(solicitud, new Date());

  if (vista.kind !== "OK" || !solicitud) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-12">
        <div className="fo-card space-y-2 p-6 text-center">
          <p className="text-base font-semibold">No encontramos este pedido</p>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            El enlace puede haber caducado. Escribinos y te mandamos uno nuevo.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-lg space-y-6 px-4 py-10">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">
            Pedido <span className="tabular-nums">{solicitud.publicCode}</span>
          </p>
          <h1 className="text-xl font-semibold tracking-tight">{solicitud.eventTitle}</h1>
          <p className="text-sm text-[var(--fo-muted)]">
            {fechaHoraArgentina(solicitud.startsAt)}
          </p>
        </header>

        <section className="fo-card space-y-2 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">Estado</p>
          <p className="text-base font-semibold">{requestStatusLabel(solicitud.status)}</p>
          {solicitud.status === "RECHAZADA" && solicitud.rejectionReason ? (
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              {solicitud.rejectionReason}
            </p>
          ) : null}
        </section>

        {vista.puedeResponder ? (
          <section className="fo-card space-y-4 p-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Nos falta un dato</h2>
              {solicitud.infoRequested ? (
                <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
                  {solicitud.infoRequested}
                </p>
              ) : null}
            </div>
            <ResponderForm token={token} />
          </section>
        ) : null}
      </main>
    </div>
  );
}
