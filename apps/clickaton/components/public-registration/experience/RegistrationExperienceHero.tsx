type Props = {
  editionName: string;
  cityHint?: string | null;
  dateHint?: string | null;
};

const HERO_IMAGE = "/images/hero-city-photographer.jpg";

const QUICK = [
  { icon: "📸", label: "4 horas fotografiando" },
  { icon: "👥", label: "Comunidad" },
  { icon: "🏆", label: "Premios" },
  { icon: "🎯", label: "Consignas sorpresa" },
] as const;

export function RegistrationExperienceHero({
  editionName,
  cityHint,
  dateHint,
}: Props) {
  return (
    <section
      className="relative overflow-hidden rounded-[var(--ck-radius-card)] border border-ck-border"
      aria-labelledby="registration-experience-hero-title"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HERO_IMAGE}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        aria-hidden
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(10_10_10_/_0.55)_0%,rgb(10_10_10_/_0.78)_55%,rgb(10_10_10_/_0.92)_100%)]" />
      <div className="relative z-[1] flex min-h-[22rem] flex-col justify-end gap-6 p-6 md:min-h-[26rem] md:p-10 lg:p-12">
        <div className="space-y-3">
          <p className="ck-label text-ck-yellow">CLICKATÓN</p>
          <h2
            id="registration-experience-hero-title"
            className="font-sans text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl"
          >
            {editionName}
          </h2>
          <p className="text-base text-neutral-200 md:text-lg">
            {[cityHint, dateHint].filter(Boolean).join(" · ") || "Experiencia fotográfica"}
          </p>
        </div>
        <ul className="flex flex-wrap gap-2 md:gap-3">
          {QUICK.map((item) => (
            <li
              key={item.label}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-2 text-sm text-white backdrop-blur-sm"
            >
              <span aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
