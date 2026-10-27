import type { PaymentButtonBlockConfig } from "@/lib/website/blocks";
import { PAYMENT_BUTTON_DEFAULT_LABEL } from "@/lib/website/blocks";
import { externalHttpsUrl, formatPesos } from "@/lib/website/blocks-extra";
import { levelStyle } from "@/lib/website/typography";

/** Botón de pago: muestra un monto en pesos y lleva al enlace de cobro (Mercado Pago, Cobrador…)
 * en otra pestaña. No cobra nada por sí mismo: es un enlace. Sin enlace https válido, en el
 * sitio no se dibuja. */
export function PaymentButtonBlockView({ config, data }: { config: PaymentButtonBlockConfig; blockId?: string; data?: unknown }) {
  const href = externalHttpsUrl(config.url);
  if (!href && data !== undefined) return null;

  return (
    <section className="px-6 py-12">
      <div
        className="mx-auto max-w-md space-y-4 rounded-2xl border p-8 text-center"
        style={{ borderColor: "color-mix(in srgb, var(--wsite-text) 15%, transparent)" }}
      >
        {config.title.trim() ? (
          <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{config.title}</h2>
        ) : null}
        {config.amount !== null && config.amount > 0 ? (
          <p className="text-4xl font-bold tabular-nums" style={{ color: "var(--wsite-primary)" }}>
            {formatPesos(config.amount)}
          </p>
        ) : null}
        {config.description.trim() ? (
          <p className="whitespace-pre-line leading-relaxed" style={{ ...levelStyle("body", { color: true }), opacity: 0.85 }}>
            {config.description}
          </p>
        ) : null}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
            style={{
              ...levelStyle("button", { color: false }),
              borderRadius: "var(--wsite-button-radius)",
              paddingInline: "var(--wsite-button-padding-x)",
              paddingBlock: "var(--wsite-button-padding-y)",
              backgroundColor: "var(--wsite-primary)",
              color: "#ffffff",
            }}
          >
            {config.buttonLabel.trim() || PAYMENT_BUTTON_DEFAULT_LABEL}
          </a>
        ) : (
          <p className="opacity-60" style={levelStyle("body", { color: true })}>
            Pegá el enlace de cobro (https://…) en el panel para que aparezca el botón.
          </p>
        )}
      </div>
    </section>
  );
}
