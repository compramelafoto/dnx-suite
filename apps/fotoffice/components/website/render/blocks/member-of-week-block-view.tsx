import type { MemberOfWeekBlockConfig } from "@/lib/website/blocks";
import type { WebsiteDynamicData } from "@/lib/website/dynamic-data";
import type { SpotlightCardView } from "@/lib/spotlight/view";
import { BLOG_HEADING_STYLE } from "@/components/website/blog/blog-post-card";

/** Tarjeta de ejemplo para la vista previa del builder, que no recibe datos (ver `dynamic-data.ts`). */
const EJEMPLO: SpotlightCardView = {
  firstName: "Nombre",
  fullName: "Así se va a ver el socio de la semana",
  businessName: null,
  photoUrl: null,
  initials: "SS",
  zone: "Su ciudad",
  specialty: "Sus especialidades",
  answers: [
    {
      key: "passion",
      pregunta: "¿Qué es lo que más te apasiona fotografiar?",
      respuesta: "Acá aparece lo que el socio contó de sí en «Más sobre mí».",
    },
  ],
  proudPhotoUrl: null,
  colleaguePhrase: null,
  whatsappUrl: null,
  links: [],
  portfolioPath: null,
  isViewer: false,
  aboutEmpty: false,
};

/**
 * "Socio de la semana" en el sitio público.
 *
 * Con datos y sin socio publicable (no hay, o no dio permiso), no se dibuja: una sección vacía se
 * ve rota. Nunca lleva teléfono, WhatsApp ni correo: eso lo garantiza `buildSpotlightCard`.
 */
export function MemberOfWeekBlockView({
  config,
  data,
}: {
  config: MemberOfWeekBlockConfig;
  data?: WebsiteDynamicData;
}) {
  const real = data?.memberOfWeek;
  if (real && !real.card) return null;
  const card = real?.card ?? EJEMPLO;
  const semana = real?.weekLabel ?? "del viernes al jueves";

  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl" style={BLOG_HEADING_STYLE}>
            {config.title?.trim() || "Socio de la semana"}
          </h2>
          {config.intro?.trim() ? (
            <p style={{ color: "var(--wsite-body-color, var(--wsite-text))" }}>{config.intro}</p>
          ) : null}
        </div>

        <div
          className="flex flex-col gap-6 rounded-2xl border p-6 sm:flex-row"
          style={{ borderColor: "color-mix(in srgb, var(--wsite-text) 15%, transparent)" }}
        >
          {card.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto de R2, ya optimizada al subirla
            <img
              src={card.photoUrl}
              alt={`Foto de ${card.fullName}`}
              className="h-32 w-32 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full text-3xl font-semibold"
              style={{ background: "color-mix(in srgb, var(--wsite-primary) 15%, transparent)", color: "var(--wsite-primary)" }}
            >
              {card.initials}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-4" style={{ color: "var(--wsite-text)" }}>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--wsite-primary)" }}>
                {semana}
              </p>
              <h3 className="text-xl" style={BLOG_HEADING_STYLE}>
                {card.fullName}
              </h3>
              {[card.specialty, card.zone].filter(Boolean).length > 0 ? (
                <p className="text-sm opacity-80">{[card.specialty, card.zone].filter(Boolean).join(" · ")}</p>
              ) : null}
            </div>
            {card.answers.slice(0, 4).map((a) => (
              <div key={a.key} className="space-y-1">
                <p className="text-xs font-semibold opacity-70">{a.pregunta}</p>
                <p className="whitespace-pre-line text-sm">{a.respuesta}</p>
              </div>
            ))}
            {card.portfolioPath || card.links.length > 0 ? (
              <div className="flex flex-wrap gap-3 text-sm font-semibold">
                {card.portfolioPath ? (
                  <a href={card.portfolioPath} style={{ color: "var(--wsite-primary)" }}>
                    Ver su portfolio →
                  </a>
                ) : null}
                {card.links.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    style={{ color: "var(--wsite-primary)" }}
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
