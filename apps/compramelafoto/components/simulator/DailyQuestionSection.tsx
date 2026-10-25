"use client";

import Link from "next/link";
import { useState } from "react";
import DailyQuestionCard from "@/components/camofduty/DailyQuestionCard";
import DailyQuestionPopup from "@/components/camofduty/DailyQuestionPopup";

/**
 * Inicio de Cam Of Duty: la pregunta técnica del día. Primero aparece en una
 * ventana; al cerrarla, la sección se vuelve a armar y muestra lo respondido.
 */
export default function DailyQuestionSection() {
  const [round, setRound] = useState(0);
  return (
    <section className="cod-preview" aria-labelledby="cod-daily-title">
      <DailyQuestionPopup onClose={() => setRound((r) => r + 1)} />
      <div className="cod-preview__inner cod-daily-section">
        <p className="cod-section-label">Pregunta del día</p>
        <h2 id="cod-daily-title" className="cod-section-title">
          ¿Cuánto sabés de fotografía?
        </h2>
        <DailyQuestionCard key={round} />
        <p className="cod-preview__cta">
          <Link href="/camofduty/simulador" className="cod-btn cod-btn--primary">
            Entrar al simulador
          </Link>
        </p>
      </div>
    </section>
  );
}
