import CamOfDutyLogo from "@/components/simulator/CamOfDutyLogo";
import Link from "next/link";
import { TourHelpButton } from "@repo/guided-tour";

export interface SimulatorShellProps {
  children: React.ReactNode;
  /** "landing" muestra CTA al simulador; "simulator" muestra volver a inicio */
  variant?: "landing" | "simulator";
  /** Recorrido guiado de la pantalla: muestra el botón Ayuda en la barra. */
  tourId?: string;
}

export default function SimulatorShell({ children, variant = "landing", tourId }: SimulatorShellProps) {
  return (
    <div className={`cod-shell${variant === "simulator" ? " cod-shell--simulator" : ""}`}>
      <header className="cod-header">
        <CamOfDutyLogo variant="header" href="/camofduty" />

        <nav className="cod-nav" aria-label="Navegación Cam Of Duty">
          {variant === "landing" ? (
            <>
              <Link href="/camofduty/curso" className="cod-btn cod-btn--ghost cod-btn--sm">
                Curso
              </Link>
              <Link href="/camofduty/estudio" className="cod-btn cod-btn--ghost cod-btn--sm">
                Estudio Fotográfico
              </Link>
              <Link href="/camofduty/simulador" className="cod-btn cod-btn--primary cod-btn--sm">
                Entrar al simulador
              </Link>
            </>
          ) : (
            <>
              {tourId ? (
                <TourHelpButton
                  tourId={tourId}
                  className="cod-btn cod-btn--ghost cod-btn--sm"
                  title="Recorrido guiado por los controles de esta pantalla"
                />
              ) : null}
              <Link href="/camofduty/estudio" className="cod-btn cod-btn--ghost cod-btn--sm">
                Estudio Fotográfico
              </Link>
              <Link href="/camofduty/simulador" className="cod-btn cod-btn--ghost cod-btn--sm">
                Simulador
              </Link>
              <Link href="/camofduty/curso" className="cod-btn cod-btn--ghost cod-btn--sm">
                Curso
              </Link>
              <Link href="/camofduty" className="cod-btn cod-btn--secondary cod-btn--sm">
                Inicio
              </Link>
            </>
          )}
        </nav>
      </header>

      {children}

      {variant !== "simulator" && (
        <footer className="cod-footer">
          <CamOfDutyLogo variant="header" className="cod-brand-logo--footer" />
        </footer>
      )}
    </div>
  );
}
