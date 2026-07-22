import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { cn } from "@/lib/cn";
import { formarParteContent } from "@/content/formar-parte";

const { levels } = formarParteContent;

type CellValue = "yes" | "no" | "star";
type TierId = (typeof levels.tiers)[number]["id"];
type Metal = (typeof levels.tiers)[number]["metal"];

const cellLabel: Record<CellValue, string> = {
  yes: "Disponible",
  no: "No incluido",
  star: "Destacado",
};

const metalStyles: Record<
  Metal,
  { ring: string; fill: string; text: string; label: string }
> = {
  bronze: {
    ring: "from-[#8a4f22] via-[#B87333] to-[#e0a06a]",
    fill: "from-[#3a2414] via-[#6b3e1c] to-[#B87333]",
    text: "text-[#E8C4A0]",
    label: "text-[#C9894A]",
  },
  silver: {
    ring: "from-[#8a8e96] via-[#BFC3C9] to-[#e8eaed]",
    fill: "from-[#2a2d33] via-[#5c6169] to-[#BFC3C9]",
    text: "text-[#E8EAED]",
    label: "text-[#BFC3C9]",
  },
  gold: {
    ring: "from-[#8a7020] via-[#D4AF37] to-[#f0d78c]",
    fill: "from-[#3a3010] via-[#8a7020] to-[#D4AF37]",
    text: "text-[#F5E6B8]",
    label: "text-[#D4AF37]",
  },
};

function MetalBadge({ metal, label }: { metal: Metal; label: string }) {
  const styles = metalStyles[metal];

  return (
    <div className="flex flex-col items-center gap-3">
      <span
        className={cn(
          "relative inline-flex size-12 items-center justify-center rounded-full bg-gradient-to-br p-[2px] shadow-[0_0_24px_rgb(0_0_0_/0.35)] sm:size-14",
          styles.ring,
        )}
        aria-hidden
      >
        <span
          className={cn(
            "flex size-full items-center justify-center rounded-full bg-gradient-to-br",
            styles.fill,
          )}
        >
          <span
            className={cn(
              "text-[0.65rem] font-semibold uppercase tracking-[0.18em] sm:text-xs",
              styles.text,
            )}
          >
            {label.slice(0, 1)}
          </span>
        </span>
      </span>
      <span
        className={cn(
          "text-[0.65rem] font-semibold uppercase tracking-[0.22em]",
          styles.label,
        )}
      >
        {label}
      </span>
    </div>
  );
}

function CellMark({ value }: { value: CellValue }) {
  if (value === "yes") {
    return (
      <span
        className="inline-flex size-8 items-center justify-center text-lg font-semibold text-ck-yellow"
        aria-label={cellLabel.yes}
      >
        ✓
      </span>
    );
  }

  if (value === "star") {
    return (
      <span
        className="inline-flex size-8 items-center justify-center text-lg text-ck-yellow"
        aria-label={cellLabel.star}
      >
        ★
      </span>
    );
  }

  return (
    <span
      className="inline-flex size-8 items-center justify-center text-lg text-ck-text-muted/55"
      aria-label={cellLabel.no}
    >
      —
    </span>
  );
}

function cellForTier(
  row: (typeof levels.rows)[number],
  tierId: TierId,
): CellValue {
  return row[tierId];
}

export function JoinLevels() {
  return (
    <Section
      tone="base"
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="join-levels-title"
    >
      <Container width="wide">
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{levels.eyebrow}</p>
          <h2 id="join-levels-title" className="ck-display-lg mt-6 text-ck-text">
            {levels.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{levels.lead}</p>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 sm:mt-12">
          {levels.legend.map((item) => (
            <div
              key={item.symbol}
              className="flex items-center gap-3 text-sm text-ck-text-secondary"
            >
              <span className="inline-flex w-5 justify-center text-ck-yellow" aria-hidden>
                {item.symbol === "check" ? "✓" : item.symbol === "star" ? "★" : "—"}
              </span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <p className="mt-8 flex items-center gap-3 text-sm text-ck-text-muted lg:hidden">
          <span
            className="inline-flex h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-ck-border"
            aria-hidden
          >
            <span className="block h-full w-1/2 rounded-full bg-ck-yellow/80" />
          </span>
          {levels.scrollHint}
        </p>

        <div className="relative mt-8 sm:mt-10">
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-ck-bg to-transparent lg:hidden"
            aria-hidden
          />

          <div className="overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <caption className="sr-only">
                Comparativa de beneficios por tipo de alianza Clickatón
              </caption>

              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-20 min-w-[14rem] border-b border-ck-border bg-ck-bg px-5 py-8 text-left text-xs font-semibold uppercase tracking-[0.18em] text-ck-text-muted sm:min-w-[16rem] sm:px-6"
                  >
                    Beneficio
                  </th>
                  {levels.tiers.map((tier) => (
                    <th
                      key={tier.id}
                      scope="col"
                      className={cn(
                        "relative min-w-[11.5rem] border-b px-4 py-8 text-center align-bottom sm:min-w-[13rem] sm:px-5",
                        tier.highlight
                          ? "border-ck-yellow/50 bg-[rgb(255_196_0_/0.06)]"
                          : "border-ck-border bg-ck-bg",
                      )}
                    >
                      {tier.highlight && tier.badge ? (
                        <span className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full border border-ck-yellow/45 bg-ck-yellow/10 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ck-yellow">
                          {tier.badge}
                        </span>
                      ) : null}

                      <div
                        className={cn(
                          "flex flex-col items-center gap-4",
                          tier.highlight ? "pt-6" : "pt-2",
                        )}
                      >
                        <MetalBadge metal={tier.metal} label={tier.metalLabel} />
                        <span
                          className={cn(
                            "max-w-[10rem] text-sm font-semibold leading-snug tracking-tight sm:text-base",
                            tier.highlight ? "text-ck-text" : "text-ck-text-secondary",
                          )}
                        >
                          {tier.name}
                        </span>
                      </div>

                      {tier.highlight ? (
                        <span
                          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-ck-yellow"
                          aria-hidden
                        />
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {levels.rows.map((row, index) => (
                  <tr
                    key={row.benefit}
                    className="group border-b border-ck-border/70 last:border-b-0"
                  >
                    <th
                      scope="row"
                      className={cn(
                        "sticky left-0 z-10 px-5 py-4 text-left text-sm font-medium leading-snug text-ck-text sm:px-6 sm:text-[0.95rem]",
                        index % 2 === 0 ? "bg-ck-bg" : "bg-ck-surface-base/40",
                      )}
                    >
                      {row.benefit}
                    </th>
                    {levels.tiers.map((tier) => {
                      const value = cellForTier(row, tier.id);
                      return (
                        <td
                          key={`${row.benefit}-${tier.id}`}
                          className={cn(
                            "px-4 py-4 text-center sm:px-5",
                            tier.highlight
                              ? index % 2 === 0
                                ? "bg-[rgb(255_196_0_/0.05)]"
                                : "bg-[rgb(255_196_0_/0.08)]"
                              : index % 2 === 0
                                ? "bg-ck-bg"
                                : "bg-ck-surface-base/40",
                            tier.highlight && "border-x border-ck-yellow/25",
                          )}
                        >
                          <CellMark value={value} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Container>
    </Section>
  );
}
