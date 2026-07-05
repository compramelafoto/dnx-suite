import CamOfDutyLogo from "@/components/simulator/CamOfDutyLogo";
import Link from "next/link";

export default function SimulatorHero() {
  return (
    <section className="cod-hero" aria-labelledby="cod-hero-title">
      <div className="cod-hero__grid-bg" aria-hidden="true" />
      <div className="cod-hero__glow" aria-hidden="true" />

      <div className="cod-hero__inner">
        <CamOfDutyLogo variant="hero" />

        <h1 id="cod-hero-title" className="cod-hero__sr-title">
          Cam Of Duty — Simulador Fotográfico Interactivo
        </h1>

        <p className="cod-hero__lead">
          Entrená exposición, enfoque, composición e iluminación en un entorno virtual diseñado
          para aprender fotografía practicando.
        </p>

        <div className="cod-hero__actions">
          <Link href="/camofduty/simulador" className="cod-btn cod-btn--primary cod-btn--full-mobile">
            Entrar al simulador
          </Link>
          <a href="#modulos" className="cod-btn cod-btn--secondary cod-btn--full-mobile">
            Ver módulos
          </a>
        </div>
      </div>
    </section>
  );
}
