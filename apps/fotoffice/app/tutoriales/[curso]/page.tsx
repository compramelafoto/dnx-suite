import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnlaceIngresar } from "@/components/landing/enlace-ingresar";
import { MarcoTutoriales } from "@/components/tutoriales/marco-tutoriales";
import { ReproductorCurso } from "@/components/tutoriales/reproductor-curso";
import { clasesDelCurso } from "@/lib/tutoriales/curso";
import { cursoTutorial } from "@/lib/tutoriales/cursos";
import { videosDelCurso } from "@/lib/tutoriales/videos";

// Los links se cargan desde /admin/tutoriales: la página tiene que leerlos en cada visita.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ curso: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const curso = cursoTutorial((await params).curso);
  if (!curso) return {};
  return {
    title: `${curso.titulo} | Tutoriales de FOTOFFICE`,
    description: `${curso.lema}. ${clasesDelCurso(curso).length} clases cortas y gratis, sobre las pantallas reales.`,
  };
}

export default async function CursoTutorialPage({ params }: Props) {
  const curso = cursoTutorial((await params).curso);
  if (!curso) notFound();
  const videos = await videosDelCurso(curso);
  const total = clasesDelCurso(curso).length;
  const publicadas = Object.keys(videos).length;

  return (
    <MarcoTutoriales>
      <header className="mb-10 max-w-2xl">
        <Link href="/tutoriales" className="text-sm text-[var(--fo-accent-hover)] hover:underline">
          Todos los tutoriales
        </Link>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight md:text-[2.5rem]">
          {curso.titulo}
        </h1>
        <p className="mt-4 text-lg text-[var(--fo-text-secondary)]">{curso.lema}.</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--fo-muted)]">
          {total} clases cortas, {curso.intro}
          {publicadas > 0 && publicadas < total
            ? ` Ya ${publicadas === 1 ? "hay 1 clase publicada" : `hay ${publicadas} clases publicadas`}; las demás se suman pronto.`
            : ""}
        </p>
      </header>

      <ReproductorCurso bloques={curso.bloques} detalles={curso.detalles} videos={videos} />

      <div className="mt-16 flex flex-col gap-6 rounded-[var(--fo-radius)] bg-[#0f172a] p-8 text-white md:flex-row md:items-center md:justify-between md:p-10">
        <div className="max-w-xl">
          <h2 className="text-2xl font-semibold">{curso.cierre.titulo}</h2>
          <p className="mt-2 text-white/75">{curso.cierre.texto}</p>
        </div>
        <EnlaceIngresar className="fo-btn fo-btn-primary shrink-0">Entrar a FOTOFFICE</EnlaceIngresar>
      </div>
    </MarcoTutoriales>
  );
}
