import CamOfDutyLogo from "@/components/simulator/CamOfDutyLogo";
import Link from "next/link";

export interface SimulatorShellProps {
  children: React.ReactNode;
  /** "landing" muestra CTA al simulador; "simulator" muestra volver a inicio */
  variant?: "landing" | "simulator";
}

export default function SimulatorShell({ children, variant = "landing" }: SimulatorShellProps) {
  return (
    <div className={`cod-shell${variant === "simulator" ? " cod-shell--simulator" : ""}`}>
      <header className="cod-header">
        <CamOfDutyLogo variant="header" href="/camofduty" />

        <nav className="cod-nav" aria-label="Navegación Cam Of Duty">
          {variant === "landing" ? (
            <Link href="/camofduty/simulador" className="cod-btn cod-btn--primary cod-btn--sm">
              Entrar al simulador
            </Link>
          ) : (
            <>
              <Link href="/camofduty#modulos" className="cod-btn cod-btn--ghost cod-btn--sm">
                Módulos
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
