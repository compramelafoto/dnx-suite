"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DailyQuestionCard from "@/components/camofduty/DailyQuestionCard";
import { argentinaDateKey } from "@/lib/camofduty/daily-question-pick";

const SEEN_KEY = "cod-pregunta-del-dia-vista";

/**
 * Ventana con la Pregunta del día apenas se entra a Cam Of Duty: aparece una
 * vez por día (hora argentina) en cada navegador; al cerrarla queda la misma
 * pregunta en la sección del inicio.
 */
export default function DailyQuestionPopup({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(SEEN_KEY);
    } catch {
      // Sin almacenamiento (ventana privada): se muestra igual.
    }
    if (seen !== argentinaDateKey()) setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  });

  const close = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, argentinaDateKey());
    } catch {
      // Sin almacenamiento: se cierra igual.
    }
    setOpen(false);
    onClose?.();
  };

  if (!open) return null;

  return (
    <div className="cod-daily-popup" role="presentation" onClick={close}>
      <div className="cod-daily-popup__dialog" role="dialog" aria-modal="true" aria-label="Pregunta del día" onClick={(e) => e.stopPropagation()}>
        <div className="cod-daily-popup__top">
          <p className="cod-section-label">Pregunta del día</p>
          <button type="button" className="cod-daily-popup__close" onClick={close} aria-label="Cerrar">
            ×
          </button>
        </div>
        <DailyQuestionCard />
        <div className="cod-daily-popup__actions">
          <button type="button" className="cod-btn cod-btn--ghost" onClick={close}>
            Cerrar
          </button>
          <Link href="/camofduty/simulador" className="cod-btn cod-btn--primary" onClick={close}>
            Entrar al simulador
          </Link>
        </div>
      </div>
    </div>
  );
}
