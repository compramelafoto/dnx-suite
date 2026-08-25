/**
 * Tarjeta pública de un concurso próximo. Componente reutilizable: no sabe nada
 * de "El País que Miramos" en particular.
 *
 * Es un Server Component; el botón "Notificarme" es el único cliente.
 */
import type { UpcomingContestCard as CardData } from "../../lib/fotorank/upcoming/service";
import { NotifyMeButton } from "./NotifyMeButton";

export type UpcomingContestCardProps = {
  card: CardData;
  /** Estado del interés del usuario actual. null = sin registro o sin sesión. */
  interest: { status: "ACTIVE" | "CANCELLED" | "CONVERTED"; benefitEligible: boolean } | null;
  /** Marca visual de que la tarjeta se está previsualizando desde administración. */
  previewMode?: boolean;
  /** Ancho de referencia para el preview responsive. */
  variant?: "desktop" | "mobile";
};

export function UpcomingContestCard({
  card,
  interest,
  previewMode = false,
  variant = "desktop",
}: UpcomingContestCardProps) {
  const isMobile = variant === "mobile";

  return (
    <article
      data-testid="upcoming-contest-card"
      data-variant={variant}
      className={[
        "fr-recuadro overflow-hidden border border-fr-border bg-fr-card",
        isMobile ? "w-full max-w-[22rem]" : "w-full max-w-[34rem]",
      ].join(" ")}
    >
      {/* Imagen o placeholder administrativo: nunca una imagen ficticia como definitiva. */}
      <div
        className={[
          "relative flex items-center justify-center border-b border-fr-border bg-[#0d0d0d]",
          isMobile ? "h-40" : "h-56",
        ].join(" ")}
      >
        {card.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.coverImageUrl}
            alt={card.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <span className="text-xs uppercase tracking-[0.2em] text-[#6b6b6b]">
              Sin imagen cargada
            </span>
            <span className="text-[0.7rem] text-[#4d4d4d]">
              Placeholder administrativo — no publicar así
            </span>
          </div>
        )}

        {previewMode ? (
          <span className="absolute left-3 top-3 rounded-sm bg-[#7a2e2e] px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white">
            Vista previa
          </span>
        ) : null}
      </div>

      <div className={isMobile ? "space-y-4 p-5" : "space-y-5 p-7"}>
        <p className="fr-eyebrow text-gold">{card.badge}</p>

        <h3
          className={[
            "font-sans font-semibold uppercase tracking-tight text-fr-primary",
            isMobile ? "text-xl" : "text-3xl",
          ].join(" ")}
        >
          {card.title}
        </h3>

        {card.tagline ? (
          <p className={isMobile ? "text-base text-gold" : "text-lg text-gold"}>{card.tagline}</p>
        ) : null}

        {card.summary ? (
          <p className="text-sm leading-relaxed text-[#a1a1a1]">{card.summary}</p>
        ) : null}

        <div className="pt-2">
          <NotifyMeButton
            contestId={card.id}
            slug={card.slug}
            contestTitle={card.title}
            initialInterest={interest}
            disabledReason={
              previewMode ? "Vista previa administrativa: el registro real está deshabilitado." : null
            }
          />
        </div>
      </div>
    </article>
  );
}
