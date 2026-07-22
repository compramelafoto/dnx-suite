import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { organizarSedeContent } from "@/content/organizar-sede";

const { map } = organizarSedeContent;

export function OrganizerMap() {
  const cities = map.cities;
  const highlight = map.highlight;

  return (
    <Section
      tone="base"
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="organizer-map-title"
    >
      <Container>
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{map.eyebrow}</p>
          <h2 id="organizer-map-title" className="ck-display-lg mt-6 text-ck-text">
            {map.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{map.lead}</p>
        </div>

        <div className="mt-14 border border-ck-border bg-ck-surface-base/40 p-8 sm:mt-16 sm:p-10 lg:p-12">
          <p
            className="text-2xl uppercase tracking-wide text-ck-yellow sm:text-3xl"
            style={{ fontFamily: "var(--ck-font-display)" }}
          >
            Red en expansión
          </p>
          <p className="ck-body-md mt-5 max-w-prose text-ck-text-secondary">
            Ciudades con potencial para vivir Clickatón — y una invitación abierta
            para que la tuya se sume.
          </p>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {cities.map((city) => (
              <li
                key={city.name}
                className="flex items-center gap-3 border border-ck-border/80 bg-ck-surface-base/40 px-3 py-2.5"
              >
                <span
                  className="size-2 shrink-0 rounded-full bg-ck-yellow"
                  aria-hidden
                />
                <span className="ck-body-sm text-ck-text">{city.name}</span>
              </li>
            ))}
            <li className="col-span-2 flex items-center gap-3 border border-ck-yellow/50 bg-[var(--ck-brand-primary-soft)] px-3 py-3 sm:col-span-3 lg:col-span-4">
              <span
                className="size-2.5 shrink-0 rounded-full bg-ck-yellow"
                aria-hidden
              />
              <span className="ck-label text-ck-yellow">{highlight.label}</span>
            </li>
          </ul>
        </div>
      </Container>
    </Section>
  );
}
