import { CoordinateGrid } from "@/components/brand/CoordinateGrid";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { FocusMark } from "@/components/ui/FocusMark";
import { homeContent } from "@/content/home";

export function ManifestoBlock() {
  const { manifesto } = homeContent;

  return (
    <Section
      id={manifesto.id}
      tone="dark"
      grain
      className="relative overflow-hidden border-y border-ck-yellow/60"
      aria-labelledby="manifesto-title"
    >
      <CoordinateGrid className="opacity-[0.05]" />
      <Container className="relative z-[2] max-w-3xl py-8 text-center md:py-12">
        <p className="ck-overline text-ck-yellow">{manifesto.eyebrow}</p>
        <FocusMark className="mx-auto mt-[var(--ck-stack-block)] text-ck-yellow" size="lg" />
        <h2
          id="manifesto-title"
          className="ck-display-md mt-[var(--ck-stack-title-to-subtitle)] text-ck-text"
        >
          {manifesto.lines[0]}
          <br />
          {manifesto.lines[1]}
        </h2>
        <p className="ck-accent-script mt-5 text-2xl text-ck-text-secondary md:text-3xl">
          Salí a buscar el instante.
        </p>
        <p className="ck-body-lg mx-auto mt-[var(--ck-stack-subtitle-to-content)] max-w-prose text-ck-text-secondary">
          {manifesto.body}
        </p>
      </Container>
    </Section>
  );
}
