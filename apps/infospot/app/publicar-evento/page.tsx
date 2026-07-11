import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@repo/db";
import { EditorialContainer, Section } from "@/components/foundations";
import { submitPublicEventAndRedirect } from "@/app/actions/events";
import { PublicEventForm } from "@/components/events/PublicEventForm";

export const metadata: Metadata = {
  title: "Publicá tu evento",
  description:
    "Sumá tu evento a Info Spot de forma gratuita para que más personas lo descubran.",
  alternates: { canonical: "/publicar-evento" },
};

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function PublicarEventoPage({ searchParams }: Props) {
  const params = await searchParams;
  const categories = await prisma.infoSpotCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <Section spacing="lg">
      <EditorialContainer className="max-w-3xl">
        <p className="is-eyebrow">Organizadores</p>
        <h1 className="is-h1 mt-3 text-3xl md:text-4xl">
          Publicá tu evento gratuitamente
        </h1>
        <p className="is-body mt-4 max-w-2xl text-base md:text-lg">
          Sumalo a Info Spot para que más personas puedan descubrirlo y para
          que, próximamente, fotógrafos puedan postularse para cubrirlo.
        </p>

        {params.error ? (
          <p
            role="alert"
            className="mt-6 border border-[var(--is-border)] bg-[var(--is-surface-muted)] px-4 py-3 text-sm text-[var(--is-text)]"
          >
            {params.error}
          </p>
        ) : null}

        <div className="mt-10">
          <PublicEventForm
            categories={categories}
            action={submitPublicEventAndRedirect}
          />
        </div>

        <p className="mt-10 text-sm text-[var(--is-text-secondary)]">
          ¿Ya publicaste?{" "}
          <Link href="/eventos" className="text-[var(--is-accent)] hover:underline">
            Ver agenda de eventos
          </Link>
        </p>
      </EditorialContainer>
    </Section>
  );
}
