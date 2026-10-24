import Link from "next/link";
import DailyQuestionCard from "@/components/camofduty/DailyQuestionCard";

/** Inicio de Cam Of Duty: la pregunta técnica del día (reemplaza la vista previa vacía). */
export default function DailyQuestionSection() {
  return (
    <section className="cod-preview" aria-labelledby="cod-daily-title">
      <div className="cod-preview__inner cod-daily-section">
        <p className="cod-section-label">Pregunta del día</p>
        <h2 id="cod-daily-title" className="cod-section-title">
          ¿Cuánto sabés de fotografía?
        </h2>
        <DailyQuestionCard />
        <p className="cod-preview__cta">
          <Link href="/camofduty/simulador" className="cod-btn cod-btn--primary">
            Entrar al simulador
          </Link>
        </p>
      </div>
    </section>
  );
}
