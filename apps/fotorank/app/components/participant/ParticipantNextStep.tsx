import { CalendarClock } from "lucide-react";
import type { NextStepBlock } from "../../lib/fotorank/participant-experience";

type Props = {
  block: NextStepBlock;
};

export function ParticipantNextStep({ block }: Props) {
  return (
    <section
      className={`fr-participant-next-step fr-participant-next-step--${block.tone}`}
      aria-labelledby="participant-next-step-title"
    >
      <h2 id="participant-next-step-title" className="fr-participant-next-step__title">
        {block.title}
      </h2>
      <p className="fr-participant-next-step__message">{block.message}</p>
      {block.facts.length > 0 ? (
        <dl className="fr-participant-next-step__facts">
          {block.facts.map((f) => (
            <div key={f.label} className="fr-participant-next-step__fact">
              <dt>
                {f.label.toLowerCase().includes("apertura") ||
                f.label.toLowerCase().includes("fecha") ? (
                  <CalendarClock width={14} height={14} aria-hidden className="inline-block mr-1" />
                ) : null}
                {f.label}
              </dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
