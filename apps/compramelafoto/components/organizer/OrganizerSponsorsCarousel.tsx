import type { CSSProperties } from "react";
import type { OrganizerPublicSponsor } from "@/lib/organizer-public-landing-server";

function SponsorCard({ sponsor }: { sponsor: OrganizerPublicSponsor }) {
  const logo = (
    <div className="org-logo-tile mx-auto mb-3 flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 p-2 overflow-hidden">
      <img
        src={sponsor.logoUrl}
        alt=""
        className="mx-auto block max-h-full max-w-full h-auto w-auto object-contain object-center"
        loading="lazy"
      />
    </div>
  );

  const body = (
    <>
      {logo}
      <h3 className="font-semibold text-gray-900 m-0 text-base line-clamp-2 w-full min-w-0">
        {sponsor.name}
      </h3>
      <p className="ds-readable-text text-xs text-gray-500 m-0 mt-2 w-full">Auspiciante</p>
      {sponsor.url ? (
        <span
          className="mt-4 inline-flex items-center justify-center self-center px-5 py-2.5 rounded-lg text-sm font-medium text-white whitespace-nowrap min-w-[9rem]"
          style={{ backgroundColor: "var(--org-primary, #c27b3d)" }}
        >
          Visitar sitio
        </span>
      ) : null}
    </>
  );

  const className =
    "org-sponsor-card org-photographer-card ds-card group rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 flex flex-col items-stretch text-center shadow-sm hover:shadow-lg hover:border-[#c27b3d]/25 transition-all duration-200 w-full h-full";

  if (sponsor.url) {
    return (
      <a
        href={sponsor.url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={`Visitar sitio de ${sponsor.name}`}
      >
        {body}
      </a>
    );
  }

  return (
    <article className={className} aria-label={sponsor.name}>
      {body}
    </article>
  );
}

/** Repite sponsors para loop continuo del marquee (mínimo 6 ítems en track). */
function buildMarqueeTrack(sponsors: OrganizerPublicSponsor[]): OrganizerPublicSponsor[] {
  if (sponsors.length === 0) return [];
  const minItems = 6;
  const repeats = Math.max(2, Math.ceil(minItems / sponsors.length));
  const track: OrganizerPublicSponsor[] = [];
  for (let r = 0; r < repeats; r++) {
    track.push(...sponsors);
  }
  return [...track, ...track];
}

export default function OrganizerSponsorsCarousel({ sponsors }: { sponsors: OrganizerPublicSponsor[] }) {
  if (sponsors.length === 0) return null;

  const track = buildMarqueeTrack(sponsors);
  const durationSec = Math.max(28, sponsors.length * 14);

  return (
    <div
      className="org-sponsor-carousel relative overflow-hidden py-2 w-full"
      role="region"
      aria-label="Auspiciantes"
      style={{ "--org-sponsor-duration": `${durationSec}s` } as CSSProperties}
    >
      <div className="org-sponsor-carousel-fade org-sponsor-carousel-fade--left" aria-hidden />
      <div className="org-sponsor-carousel-fade org-sponsor-carousel-fade--right" aria-hidden />
      <div className="org-sponsor-marquee flex items-stretch gap-4 sm:gap-5 w-max" role="list">
        {track.map((s, i) => (
          <div key={`${s.id}-${i}`} className="org-sponsor-marquee-item" role="listitem">
            <SponsorCard sponsor={s} />
          </div>
        ))}
      </div>
    </div>
  );
}
