import Link from "next/link";

import { ReenviarVerificacion } from "./ReenviarVerificacion";

/**
 * Qué le falta al jurado para que su ficha se vea.
 *
 * Son dos cosas distintas y conviene que las vea separadas: confirmar el correo
 * es cosa suya, la revisión es nuestra.
 */
export function EstadoDeMiFicha({
  estado,
  motivo,
  correoConfirmado,
  publicSlug,
  estaPublicada,
}: {
  estado: "PENDING" | "APPROVED" | "REJECTED";
  motivo: string | null;
  correoConfirmado: boolean;
  publicSlug: string;
  estaPublicada: boolean;
}) {
  if (estado === "APPROVED") {
    return (
      <section className="rounded border border-emerald-900 bg-emerald-950/30 p-4">
        <p className="text-sm font-medium text-emerald-300">Tu ficha está aprobada.</p>
        {estaPublicada ? (
          <p className="mt-1 text-sm text-fr-muted">
            Tu página pública es{" "}
            <Link href={`/jurados/publico/${publicSlug}`} className="underline underline-offset-2">
              /jurados/publico/{publicSlug}
            </Link>
            .
          </p>
        ) : null}
      </section>
    );
  }

  if (estado === "REJECTED") {
    return (
      <section className="rounded border border-red-900 bg-red-950/30 p-4">
        <p className="text-sm font-medium text-red-300">Tu ficha no quedó aprobada.</p>
        {motivo ? (
          <p className="mt-2 text-sm text-fr-muted">
            <span className="font-medium">Por qué:</span> {motivo}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-fr-muted">
          Corregí lo que haga falta y guardá: vuelve a entrar en la cola de revisión.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded border border-amber-900 bg-amber-950/20 p-4">
      <p className="text-sm font-medium text-amber-300">Tu ficha todavía no está publicada.</p>
      <ul className="mt-2 space-y-2 text-sm text-fr-muted">
        <li>
          {correoConfirmado ? "✓" : "○"} Confirmar tu correo.{" "}
          {correoConfirmado ? (
            <span className="text-fr-muted-soft">Hecho.</span>
          ) : (
            <>
              <span className="text-fr-muted-soft">
                Sin esto tu ficha no entra a revisión.
              </span>{" "}
              <ReenviarVerificacion />
            </>
          )}
        </li>
        <li>○ Que la revisemos. Te avisamos por correo cuando esté resuelta.</li>
      </ul>
    </section>
  );
}
