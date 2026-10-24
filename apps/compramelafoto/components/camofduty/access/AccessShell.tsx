import CamOfDutyLogo from "@/components/simulator/CamOfDutyLogo";
import type { ReactNode } from "react";

/**
 * Marco de las páginas de acceso de Cam Of Duty: fondo de la marca, logo y
 * una tarjeta con el formulario. Por detrás es la cuenta de fotógrafo de CompraMeLaFoto.
 */
export default function AccessShell({ title, subtitle, children, wide = false }: { title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <main className="cod-access">
      <div className="cod-hero__grid-bg" aria-hidden="true" />
      <div className="cod-access__inner">
        <CamOfDutyLogo variant="hero" href="/camofduty" className="cod-access__logo" />
        <section className={`cod-access__card${wide ? " cod-access__card--wide" : ""}`}>
          <h1 className="cod-access__title">{title}</h1>
          {subtitle ? <p className="cod-access__subtitle">{subtitle}</p> : null}
          {children}
        </section>
        <p className="cod-access__foot">
          Cam Of Duty es gratis. Tu cuenta es de fotógrafo de{" "}
          <a href="https://www.compramelafoto.com" target="_blank" rel="noreferrer">
            CompraMeLaFoto
          </a>
          : con el mismo email y contraseña entrás a las dos.
        </p>
      </div>
    </main>
  );
}
