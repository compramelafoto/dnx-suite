import Link from "next/link";
import { MessageCircle, Sparkles } from "lucide-react";
import type { SpotlightCardView } from "@/lib/spotlight/view";

/**
 * La tarjeta del Socio de la semana.
 *
 * Sin estado ni efectos: se dibuja igual en el portal (componente de servidor) y en el sitio
 * público. Qué datos trae lo decide `buildSpotlightCard`; esto sólo los muestra.
 */
export function SpotlightCard({
  card,
  weekLabel,
  audience,
}: {
  card: SpotlightCardView;
  weekLabel: string;
  audience: "portal" | "public";
}) {
  return (
    <section className="fo-card space-y-5 border-2 border-[var(--fo-accent-soft)] p-5">
      {card.isViewer ? (
        <div className="space-y-2 rounded-lg bg-[var(--fo-accent-soft)] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4" aria-hidden />
            ¡Esta semana sos el Socio de la semana!
          </p>
          <p className="text-sm">
            Todos los socios ven tu tarjeta en su panel. Aprovechá para presentarte.
          </p>
          {card.aboutEmpty ? (
            <Link href="/portal/perfil/sobre-mi" className="fo-btn fo-btn-primary text-xs">
              Completar «Más sobre mí»
            </Link>
          ) : (
            <Link href="/portal/perfil/sobre-mi" className="text-xs underline underline-offset-2">
              Revisar lo que cuento de mí
            </Link>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        {card.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto de R2, ya optimizada al subirla
          <img
            src={card.photoUrl}
            alt={`Foto de ${card.fullName}`}
            className="h-20 w-20 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent-soft)] text-xl font-semibold"
          >
            {card.initials}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted)]">
            Socio de la semana · {weekLabel}
          </p>
          <h2 className="text-lg font-semibold">{card.fullName}</h2>
          {card.businessName ? <p className="text-sm text-[var(--fo-muted)]">{card.businessName}</p> : null}
          {[card.specialty, card.zone].filter(Boolean).length > 0 ? (
            <p className="text-sm">{[card.specialty, card.zone].filter(Boolean).join(" · ")}</p>
          ) : null}
        </div>
      </div>

      {card.answers.length > 0 ? (
        <dl className="grid gap-4 sm:grid-cols-2">
          {card.answers.map((a) => (
            <div key={a.key} className="space-y-1">
              <dt className="text-xs font-medium text-[var(--fo-muted)]">{a.pregunta}</dt>
              <dd className="whitespace-pre-line text-sm">
                {a.respuesta}
                {a.key === "proudPhotoText" && card.proudPhotoUrl ? (
                  <>
                    {" "}
                    <a
                      href={card.proudPhotoUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="underline underline-offset-2"
                    >
                      Ver la foto
                    </a>
                  </>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {audience === "portal" ? (
        <div className="space-y-3 rounded-lg border border-[var(--fo-border)] p-4">
          {card.colleaguePhrase ? <p className="text-sm font-medium">{card.colleaguePhrase}</p> : null}
          <p className="text-sm text-[var(--fo-text-secondary)]">
            Conocelo, escribile, ofrecele una mano. Las mejores alianzas empiezan con una charla
            entre colegas.
          </p>
          <Acciones card={card} />
        </div>
      ) : (
        <Acciones card={card} />
      )}
    </section>
  );
}

function Acciones({ card }: { card: SpotlightCardView }) {
  if (!card.whatsappUrl && card.links.length === 0 && !card.portfolioPath) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {card.whatsappUrl && !card.isViewer ? (
        <a
          href={card.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fo-btn fo-btn-primary text-xs"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          Escribile por WhatsApp
        </a>
      ) : null}
      {card.portfolioPath ? (
        <Link href={card.portfolioPath} className="fo-btn fo-btn-secondary text-xs">
          Ver su portfolio
        </Link>
      ) : null}
      {card.links.map((l) => (
        <a
          key={l.url}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="fo-btn fo-btn-ghost text-xs"
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}
