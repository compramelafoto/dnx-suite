import type { ReactNode } from "react";
import { EditorialContainer, Section } from "@/components/layout/containers";

type PageShellProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

/** Shell simple para páginas internas (admin / stubs). */
export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <Section spacing="lg">
      <EditorialContainer>
        <div className="max-w-2xl">
          <h1 className="is-display text-3xl md:text-4xl">{title}</h1>
          {description ? <p className="is-dek mt-4">{description}</p> : null}
        </div>
        {children ? <div className="mt-10">{children}</div> : null}
      </EditorialContainer>
    </Section>
  );
}
