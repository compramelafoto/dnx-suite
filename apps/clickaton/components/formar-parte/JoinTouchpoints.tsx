import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { cn } from "@/lib/cn";
import { formarParteContent } from "@/content/formar-parte";

const { touchpoints } = formarParteContent;

type StageIcon = (typeof touchpoints.stages)[number]["icon"];

function StageIconMark({ name }: { name: StageIcon }) {
  const common = {
    className: "size-10 sm:size-12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.35,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "megaphone":
      return (
        <svg {...common}>
          <path d="m3 11 18-5v12L3 13v-2Z" />
          <path d="M11.6 16.8a3 3 0 0 1-5.2-1.8V12" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...common}>
          <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a1.5 1.5 0 0 0 0-3V9Z" />
          <path d="M13 7v10" strokeDasharray="2 2" />
        </svg>
      );
    case "camera":
      return (
        <svg {...common}>
          <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      );
    case "gallery":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="14" height="12" rx="1.5" />
          <path d="M7 19h11a2 2 0 0 0 2-2V9" />
          <circle cx="8.5" cy="10" r="1.2" />
          <path d="m17 14-3.5-3.5L8 16" />
        </svg>
      );
    default:
      return null;
  }
}

export function JoinTouchpoints() {
  return (
    <Section
      tone="base"
      grain
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="join-touchpoints-title"
    >
      <Container width="wide">
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{touchpoints.eyebrow}</p>
          <h2
            id="join-touchpoints-title"
            className="ck-display-lg mt-6 text-ck-text"
          >
            {touchpoints.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{touchpoints.lead}</p>
        </div>

        <ul className="mt-14 grid grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-2 sm:gap-6 lg:gap-8">
          {touchpoints.stages.map((stage) => (
            <li
              key={stage.id}
              className={cn(
                "group flex flex-col border border-ck-border bg-ck-surface-base/50 p-8 sm:p-10",
                "transition-[transform,border-color,background-color] duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)]",
                "hover:-translate-y-1 hover:border-ck-yellow/45 hover:bg-ck-surface-base/80",
              )}
            >
              <div className="flex items-start justify-between gap-6">
                <span
                  className="text-5xl leading-none text-ck-yellow sm:text-6xl"
                  style={{ fontFamily: "var(--ck-font-display)" }}
                  aria-hidden
                >
                  {stage.number}
                </span>
                <span className="text-ck-yellow transition-transform duration-[var(--ck-duration-base)] group-hover:scale-105">
                  <StageIconMark name={stage.icon} />
                </span>
              </div>

              <h3
                className="mt-8 text-2xl uppercase tracking-wide text-ck-text sm:text-3xl"
                style={{ fontFamily: "var(--ck-font-display)" }}
              >
                {stage.title}
              </h3>
              <p className="ck-body-md mt-4 text-ck-text-secondary">
                {stage.description}
              </p>

              <ul className="mt-8 flex flex-wrap gap-2.5 sm:mt-10 sm:gap-3">
                {stage.badges.map((badge) => (
                  <li key={badge}>
                    <span
                      className={cn(
                        "inline-flex min-h-9 items-center border border-ck-border bg-ck-bg/60 px-3.5 py-1.5",
                        "text-xs font-medium uppercase tracking-[0.12em] text-ck-text-secondary",
                        "transition-[transform,border-color,color,background-color] duration-[var(--ck-duration-fast)] ease-[var(--ck-easing-standard)]",
                        "hover:-translate-y-0.5 hover:border-ck-yellow/50 hover:bg-ck-yellow/10 hover:text-ck-yellow",
                      )}
                    >
                      {badge}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <div className="mt-12 bg-ck-yellow px-8 py-12 text-center text-ck-bg sm:mt-16 sm:px-12 sm:py-16 lg:px-16">
          <p
            className="text-[clamp(1.75rem,4.5vw,3.25rem)] font-normal uppercase leading-[1.08] tracking-[0.02em]"
            style={{ fontFamily: "var(--ck-font-display)" }}
          >
            <span className="block">{touchpoints.highlight.line1}</span>
            <span className="mt-4 block max-w-4xl mx-auto">
              {touchpoints.highlight.line2}
            </span>
          </p>
        </div>
      </Container>
    </Section>
  );
}
