import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";

type ContentBandProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  titleId?: string;
  description?: string;
  tone?: "default" | "muted" | "yellow" | "dark" | "accent";
  children?: ReactNode;
  className?: string;
};

export function ContentBand({
  id,
  eyebrow,
  title,
  titleId,
  description,
  tone = "default",
  children,
  className,
}: ContentBandProps) {
  const headingId = titleId ?? (id ? `${id}-title` : undefined);

  return (
    <Section id={id} tone={tone} className={className} aria-labelledby={headingId}>
      <Container>
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          titleId={headingId}
        />
        {children ? <div className="mt-10">{children}</div> : null}
      </Container>
    </Section>
  );
}
