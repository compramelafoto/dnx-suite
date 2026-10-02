import Link from "next/link";
import { hiddenReasonMessage } from "@/lib/portfolio/visibility-labels";
import type { PortfolioVisibility } from "@/lib/portfolio/visibility";

/**
 * Lo primero que se lee en la pantalla: si el portfolio está al aire, y si no, por qué.
 *
 * Existe porque desaparecer del sitio sin explicación es peor que la causa. Cuando la persona no
 * puede hacer nada al respecto —lo bajó la administración, el módulo está apagado— no se ofrece un
 * botón: se dice con quién hablar.
 */
export function PortfolioStatusCard({
  visibility,
  publicHref,
}: {
  visibility: PortfolioVisibility;
  /** La dirección pública de su ficha. `null` mientras no exista el portfolio. */
  publicHref: string | null;
}) {
  if (visibility.visible) {
    return (
      <section className="fo-alert-success space-y-2">
        <p className="font-medium">Tu portfolio está publicado</p>
        <p className="text-sm">
          Se está viendo en el sitio de la institución.
          {publicHref ? (
            <>
              {" "}
              <Link href={publicHref} className="underline" target="_blank" rel="noreferrer">
                Verlo como lo ve cualquiera
              </Link>
              .
            </>
          ) : null}
        </p>
      </section>
    );
  }

  const mensaje = hiddenReasonMessage(visibility.reason);

  return (
    <section className="fo-alert-warning space-y-2">
      <p className="font-medium">{mensaje.title}</p>
      <p className="text-sm">{mensaje.detail}</p>
      {mensaje.action ? (
        <p>
          <Link href={mensaje.action.href} className="fo-btn fo-btn-secondary text-sm">
            {mensaje.action.label}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
