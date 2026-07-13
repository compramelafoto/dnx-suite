"use client";

import type { AssistantIntent } from "@/lib/editorial-assistant";

const INTENTS: {
  id: Exclude<AssistantIntent, "pending">;
  emoji: string;
  title: string;
  description: string;
}[] = [
  {
    id: "event",
    emoji: "📰",
    title: "Un evento próximo",
    description: "Elegí un evento y armamos la historia con su material.",
  },
  {
    id: "coverage",
    emoji: "📸",
    title: "Una cobertura de un evento",
    description: "Partís de coberturas fotográficas ya disponibles.",
  },
  {
    id: "independent",
    emoji: "📝",
    title: "Una noticia independiente",
    description: "Sin evento ni material previo: solo el texto y lo que sumes después.",
  },
  {
    id: "gallery",
    emoji: "🖼",
    title: "Una galería fotográfica",
    description: "La historia gira alrededor de una selección de fotografías.",
  },
];

type Props = {
  onSelect: (intent: Exclude<AssistantIntent, "pending">) => void;
  onContinuePending?: () => void;
  hasPending?: boolean;
};

export function StepIntent({ onSelect, onContinuePending, hasPending }: Props) {
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <h1 className="font-[family-name:var(--font-source-serif)] text-[clamp(1.75rem,1.3rem+1.5vw,2.5rem)] font-semibold leading-tight tracking-tight">
          ¿Qué querés contar hoy?
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--is-muted)]">
          Primero preparamos la historia. El editor aparece cuando todo esté
          organizado.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2" role="list">
        {INTENTS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className="flex h-full w-full flex-col gap-3 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white p-6 text-left transition hover:border-[var(--is-accent)] hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--is-accent)]"
            >
              <span className="text-2xl" aria-hidden>
                {item.emoji}
              </span>
              <span className="font-[family-name:var(--font-source-serif)] text-xl font-semibold tracking-tight">
                {item.title}
              </span>
              <span className="text-sm leading-relaxed text-[var(--is-muted)]">
                {item.description}
              </span>
            </button>
          </li>
        ))}
        {hasPending ? (
          <li className="sm:col-span-2">
            <button
              type="button"
              onClick={onContinuePending}
              className="flex w-full items-start gap-4 rounded-[var(--is-radius-md)] border border-dashed border-[var(--is-accent)] bg-[var(--is-accent)]/5 p-6 text-left transition hover:bg-[var(--is-accent)]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--is-accent)]"
            >
              <span className="text-2xl" aria-hidden>
                📂
              </span>
              <span>
                <span className="block font-[family-name:var(--font-source-serif)] text-xl font-semibold tracking-tight">
                  Continuar un trabajo pendiente
                </span>
                <span className="mt-2 block text-sm leading-relaxed text-[var(--is-muted)]">
                  Recuperamos evento, material y fotografías donde lo dejaste.
                </span>
              </span>
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
