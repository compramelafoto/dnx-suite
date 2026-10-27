import type { FaqBlockConfig } from "@/lib/website/blocks";
import { levelStyle } from "@/lib/website/typography";

/** Preguntas frecuentes en acordeón con `<details>`/`<summary>`: accesible con teclado y lector
 * de pantalla, y funciona sin JavaScript. La respuesta es texto plano (los saltos de línea se
 * respetan); nunca HTML. Sin ninguna pregunta escrita, en el sitio no se dibuja. */
export function FaqBlockView({ config, data }: { config: FaqBlockConfig; blockId?: string; data?: unknown }) {
  const items = config.items.filter((i) => i.question.trim());
  const preview = data === undefined;
  if (items.length === 0 && !preview) return null;
  const shown = items.length > 0 ? items : [{ id: "ejemplo", question: "Tu primera pregunta", answer: "Acá va la respuesta." }];

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        {config.title.trim() ? (
          <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{config.title}</h2>
        ) : null}
        <div className="divide-y" style={{ borderColor: "color-mix(in srgb, var(--wsite-text) 15%, transparent)" }}>
          {shown.map((item, i) => (
            <details key={item.id || i} className="group py-4">
              <summary
                className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden"
                style={{ ...levelStyle("body", { color: true }), fontWeight: 600 }}
              >
                <span>{item.question}</span>
                <span aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-45" style={{ color: "var(--wsite-primary)" }}>
                  +
                </span>
              </summary>
              {item.answer.trim() ? (
                <p className="mt-3 whitespace-pre-line leading-relaxed" style={{ ...levelStyle("body", { color: true }), opacity: 0.85 }}>
                  {item.answer}
                </p>
              ) : null}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
