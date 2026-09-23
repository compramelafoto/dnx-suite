import { Card } from "@/components/ui/Card";
import type { ProgramaDeReferidosView } from "@/lib/referrals/ui/referral-presentation";

import { ReferralShareActions } from "./ReferralShareActions";

type Props = { programa: ProgramaDeReferidosView };

export function ReferralSection({ programa }: Props) {
  return (
    <section className="space-y-4" aria-labelledby="mis-referidos-title">
      <h2 id="mis-referidos-title" className="ck-heading-md">
        Traé a tus colegas
      </h2>

      <Card variant="outlined" className="space-y-5 p-6">
        <div className="space-y-2">
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            Cada colega que traigas te descuenta tu próxima Clickatón.{" "}
            <strong className="text-ck-text">Con 5, entrás gratis.</strong> El que viene
            por tu link entra con 10% de descuento.
          </p>
        </div>

        <div className="space-y-2 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-3">
          <p className="text-xs uppercase tracking-[0.08em] text-ck-text-muted">Tu link</p>
          <p className="break-all font-mono text-xs text-ck-text-secondary">
            {programa.link}
          </p>
          <ReferralShareActions link={programa.link} />
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-ck-text-secondary">
              {programa.colegas === 0
                ? "Todavía no trajiste a nadie."
                : programa.colegas === 1
                  ? "Trajiste 1 colega."
                  : `Trajiste ${programa.colegas} colegas.`}
            </p>
            <p className="font-[family-name:var(--font-ck-display)] text-2xl text-ck-yellow">
              {programa.descuentoActual}%
            </p>
          </div>

          <div
            className="h-2 w-full overflow-hidden rounded-full bg-ck-surface-strong"
            role="progressbar"
            aria-valuenow={programa.colegas}
            aria-valuemin={0}
            aria-valuemax={5}
            aria-label="Colegas traídos"
          >
            <div
              className="h-full rounded-full bg-ck-yellow transition-[width]"
              style={{ width: `${programa.progreso}%` }}
            />
          </div>

          <p className="text-sm text-ck-text-muted">
            {programa.llegoAlTope
              ? "Llegaste al tope: tu próxima Clickatón es gratis."
              : `Te falta ${programa.faltanParaElSiguiente === 1 ? "1 colega" : `${programa.faltanParaElSiguiente} colegas`} para llegar al ${programa.siguienteDescuento}%.`}
          </p>
        </div>

        <ul className="grid grid-cols-5 gap-2 text-center">
          {programa.escalera.map((escalon) => (
            <li
              key={escalon.colegas}
              className={[
                "rounded-[var(--ck-radius-card)] border p-2",
                escalon.alcanzado
                  ? "border-ck-yellow bg-ck-surface-strong text-ck-text"
                  : "border-ck-border text-ck-text-muted",
              ].join(" ")}
            >
              <p className="text-xs">{escalon.colegas}</p>
              <p className="text-sm font-semibold">
                {escalon.descuento === 100 ? "Gratis" : `${escalon.descuento}%`}
              </p>
            </li>
          ))}
        </ul>

        <p className="text-xs leading-relaxed text-ck-text-muted">
          Un colega cuenta cuando su pago queda aprobado. Lo que acumulás no vence, y tu
          descuento se aplica solo al inscribirte. Si en esa inscripción te conviene más un
          código de descuento, usamos el código y tus colegas quedan guardados para la
          próxima.
        </p>
      </Card>
    </section>
  );
}
