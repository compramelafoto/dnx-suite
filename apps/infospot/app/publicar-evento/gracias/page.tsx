import type { Metadata } from "next";
import Link from "next/link";
import { EditorialContainer, Section } from "@/components/foundations";

export const metadata: Metadata = {
  title: "Evento recibido",
  robots: { index: false, follow: false },
};

export default function PublicarEventoGraciasPage() {
  return (
    <Section spacing="lg">
      <EditorialContainer className="max-w-2xl py-10 text-center md:py-16">
        <p className="is-eyebrow">Listo</p>
        <h1 className="is-h1 mt-3 text-3xl md:text-4xl">Recibimos tu evento</h1>
        <p className="is-body mx-auto mt-4 max-w-lg">
          Nuestro equipo lo va a revisar antes de publicarlo en la agenda. Te
          contactaremos por email si necesitamos más información.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/eventos"
            className="is-btn is-btn-solid h-11 px-5 text-sm"
          >
            Ver agenda
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center px-5 text-sm font-medium ring-1 ring-[var(--is-border)]"
          >
            Volver al inicio
          </Link>
        </div>
      </EditorialContainer>
    </Section>
  );
}
