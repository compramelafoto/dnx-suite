import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MarcoTutoriales } from "@/components/tutoriales/marco-tutoriales";
import { clasesDelCurso, rutaDelCurso } from "@/lib/tutoriales/curso";
import { CURSOS_TUTORIALES } from "@/lib/tutoriales/cursos";

export const metadata: Metadata = {
  title: "Tutoriales en video | FOTOFFICE",
  description:
    "Cursos cortos y gratis sobre las pantallas reales de FOTOFFICE: tu negocio de fotografía, tu sociedad o fotoclub y cuánto cobrar como fotógrafo.",
};

export default function TutorialesPage() {
  return (
    <MarcoTutoriales>
      <header className="mx-auto mb-10 max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Tutoriales en video</h1>
        <p className="mt-3 text-lg text-[var(--fo-text-secondary)]">
          Clases cortas, sobre las pantallas reales de FOTOFFICE, para aprender a usarlo paso a paso.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {CURSOS_TUTORIALES.map((curso) => (
          <Link
            key={curso.slug}
            href={rutaDelCurso(curso)}
            className="group flex flex-col overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] shadow-[var(--fo-shadow-sm)] transition-shadow hover:shadow-[var(--fo-shadow-md)]"
          >
            <div className="relative aspect-video bg-[var(--fo-surface-muted)]">
              <Image
                src={curso.portada.src}
                alt={curso.portada.alt}
                fill
                sizes="(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <span className="text-xs font-semibold text-[var(--fo-accent-hover)]">
                Curso en video, {clasesDelCurso(curso).length} clases
              </span>
              <h2 className="mt-2 text-lg font-semibold leading-snug">{curso.titulo}</h2>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--fo-muted)]">{curso.lema}.</p>
              <span className="mt-4 text-sm font-semibold text-[var(--fo-accent-hover)] group-hover:underline">
                Ver el curso
              </span>
            </div>
          </Link>
        ))}
      </div>
    </MarcoTutoriales>
  );
}
