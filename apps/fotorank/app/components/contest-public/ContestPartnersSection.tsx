import type { DnxPartnerDisplayTier, PublicPartnerGroup } from "@repo/partners";

type Props = {
  groups: PublicPartnerGroup[];
};

function tierLogoClass(tier: DnxPartnerDisplayTier): string {
  switch (tier) {
    case "INSTITUTIONAL":
      return "fr-contest-partner-logo fr-contest-partner-logo--institutional";
    case "MAIN":
      return "fr-contest-partner-logo fr-contest-partner-logo--main";
    case "STANDARD":
      return "fr-contest-partner-logo fr-contest-partner-logo--standard";
    case "SUPPORTING":
    default:
      return "fr-contest-partner-logo fr-contest-partner-logo--supporting";
  }
}

function PartnerCard({
  name,
  logoUrl,
  websiteUrl,
  displayTier,
}: {
  name: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  displayTier: DnxPartnerDisplayTier;
}) {
  const inner = (
    <>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className={tierLogoClass(displayTier)} />
      ) : (
        <span className={`${tierLogoClass(displayTier)} fr-contest-partner-logo--fallback`}>
          {name}
        </span>
      )}
      {logoUrl ? <span className="fr-contest-partner-name">{name}</span> : null}
    </>
  );

  if (websiteUrl) {
    const isTracked = websiteUrl.startsWith("/r/");
    const href = isTracked
      ? websiteUrl
      : websiteUrl.startsWith("http")
        ? websiteUrl
        : `https://${websiteUrl}`;
    return (
      <a
        href={href}
        target={isTracked ? undefined : "_blank"}
        rel={isTracked ? undefined : "noopener noreferrer"}
        className="fr-contest-partner-item fr-contest-partner-item--link"
      >
        {inner}
      </a>
    );
  }
  return <div className="fr-contest-partner-item">{inner}</div>;
}

/** Sección pública de partners (sin dependencia del design system contest-public WIP). */
export function ContestPartnersSection({ groups }: Props) {
  if (!groups.length) return null;

  return (
    <section
      id="partners"
      className="fr-section border-b border-fr-border bg-fr-bg-elevated/40 py-16 md:py-20"
      aria-labelledby="contest-partners-title"
    >
      <div className="fr-container-wide mx-auto px-8 md:px-10 lg:px-12">
        <h2
          id="contest-partners-title"
          className="font-sans text-2xl font-semibold tracking-tight text-fr-primary md:text-3xl"
        >
          Instituciones y aliados
        </h2>
        <p className="mt-4 max-w-2xl text-base text-fr-muted">
          Organizan, auspician y colaboran con este concurso.
        </p>
        <div className="mt-10 space-y-12">
          {groups.map((group) => (
            <div key={group.role} className="fr-contest-partner-group">
              <h3 className="fr-contest-partner-group__heading">{group.heading}</h3>
              <ul className="fr-contest-partner-grid">
                {group.items.map((item) => (
                  <li key={item.participationId}>
                    <PartnerCard
                      name={item.partnerName}
                      logoUrl={item.logoUrl}
                      websiteUrl={item.websiteUrl}
                      displayTier={item.displayTier}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
