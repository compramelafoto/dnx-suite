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
      className="relative overflow-hidden border-y-2 border-ck-yellow"
      aria-labelledby="manifesto-title"
    >
      <CoordinateGrid className="opacity-[0.12] invert" />
      <Container className="relative z-[2] max-w-3xl py-4 text-center">
        <p className="ck-label text-ck-yellow">{manifesto.eyebrow}</p>
        <FocusMark className="mx-auto mt-6 text-ck-yellow" size="lg" />
        <h2 id="manifesto-title" className="ck-display-md mt-6 text-ck-yellow">
          {manifesto.lines[0]}
          <br />
          {manifesto.lines[1]}
        </h2>
        <p className="ck-body-lg mx-auto mt-6 max-w-prose text-ck-gray-200">
          {manifesto.body}
        </p>
      </Container>
    </Section>
  );
}
