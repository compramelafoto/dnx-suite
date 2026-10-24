"use client";

import { useEffect, useId, useState } from "react";
import { DAILY_QUESTIONS } from "@/lib/camofduty/daily-questions";
import { argentinaDateKey, questionIndexForDay, randomOtherIndex } from "@/lib/camofduty/daily-question-pick";

const LETTERS = ["A", "B", "C", "D"] as const;
const STORAGE_KEY = "cod-pregunta-del-dia";

interface Saved {
  date: string;
  index: number;
  chosen: number;
}

function loadSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(value: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Sin almacenamiento (ventana privada): se responde igual, sólo no se recuerda.
  }
}

/**
 * Pregunta del día: una pregunta técnica de fotografía con cuatro opciones.
 * Al responder marca la correcta (y la elegida, si no lo era) y explica por qué.
 * Se puede pedir otra al azar. La respuesta del día queda recordada en este navegador.
 */
export default function DailyQuestionCard() {
  // La fecha (y la pregunta) se eligen en el navegador: el servidor no sabe la hora de quien entra.
  const [index, setIndex] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [isDaily, setIsDaily] = useState(true);
  // La tarjeta puede estar dos veces (ventana emergente y sección): cada una con su id.
  const questionId = useId();

  useEffect(() => {
    const date = argentinaDateKey();
    const daily = questionIndexForDay(date, DAILY_QUESTIONS.length);
    const saved = loadSaved();
    setIndex(daily);
    if (saved && saved.date === date && saved.index === daily) setChosen(saved.chosen);
  }, []);

  if (index === null) {
    return <div className="cod-daily cod-daily--loading" aria-hidden="true" />;
  }

  const q = DAILY_QUESTIONS[index];
  const answered = chosen !== null;
  const right = answered && chosen === q.correct;

  const answer = (i: number) => {
    if (answered) return;
    setChosen(i);
    if (isDaily) save({ date: argentinaDateKey(), index, chosen: i });
  };

  const another = () => {
    setIndex(randomOtherIndex(index, DAILY_QUESTIONS.length));
    setChosen(null);
    setIsDaily(false);
  };

  return (
    <article className="cod-daily" aria-labelledby={questionId}>
      <header className="cod-daily__head">
        <span className="cod-daily__tag">{q.niche}</span>
        <span className="cod-daily__count">{isDaily ? "Hoy" : "Pregunta extra"}</span>
      </header>
      <h3 id={questionId} className="cod-daily__question">
        {q.question}
      </h3>
      <ol className="cod-daily__options">
        {q.options.map((option, i) => {
          const state = !answered ? "" : i === q.correct ? " is-correct" : i === chosen ? " is-wrong" : " is-dim";
          return (
            <li key={i}>
              <button type="button" className={`cod-daily__option${state}`} onClick={() => answer(i)} disabled={answered} aria-pressed={chosen === i}>
                <span className="cod-daily__letter">{LETTERS[i]}</span>
                <span>{option}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {answered ? (
        <div className={`cod-daily__result${right ? " is-right" : " is-missed"}`} role="status" aria-live="polite">
          <p className="cod-daily__verdict">{right ? "¡Correcto!" : `No. La correcta es la ${LETTERS[q.correct]}.`}</p>
          <p className="cod-daily__explanation">{q.explanation}</p>
        </div>
      ) : null}
      <footer className="cod-daily__foot">
        <button type="button" className="cod-btn cod-btn--secondary" onClick={another}>
          Otra pregunta
        </button>
      </footer>
    </article>
  );
}
