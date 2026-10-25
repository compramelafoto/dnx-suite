import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import CamOfDutyLogo from "@/components/simulator/CamOfDutyLogo";
import PrintButton from "@/components/camofduty/course/PrintButton";
import { getAuthUser } from "@/lib/auth";
import { LEVELS, lessonsOfLevel } from "@/lib/camofduty/course/lessons";
import { summarizeLevel } from "@/lib/camofduty/course/progress";
import { loadCourseProgress } from "@/lib/camofduty/course/progress-db";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Certificado — Curso Cam Of Duty", robots: { index: false, follow: false } };

const MEDAL = { ninguna: "", bronce: "bronce", plata: "plata", oro: "oro" } as const;

export default async function CertificadoPage({ params }: { params: Promise<{ nivel: string }> }) {
  const { nivel } = await params;
  const level = LEVELS.find((l) => l.id === nivel);
  if (!level) notFound();
  const user = await getAuthUser();
  if (!user) redirect(`/camofduty/ingresar?redirect=${encodeURIComponent(`/camofduty/curso/certificado/${level.id}`)}`);
  const progress = await loadCourseProgress(user.id);
  const summary = summarizeLevel(level.id, progress);
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true } }).catch(() => null);
  const name = account?.name?.trim() || account?.email || "Fotógrafo";
  // Fecha en la que aprobó la última lección del nivel (hora argentina).
  const ids = new Set(lessonsOfLevel(level.id).map((l) => l.id));
  const last = progress.filter((p) => p.passedAt && ids.has(p.lessonId)).map((p) => new Date(p.passedAt!).getTime());
  const date = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "long", year: "numeric" }).format(
    last.length ? new Date(Math.max(...last)) : new Date(),
  );

  if (!summary.complete) {
    return (
      <main className="cod-certificate-page">
        <p>
          Todavía te faltan {summary.total - summary.passed} lecciones del {level.title.toLowerCase()} para el certificado.{" "}
          <Link href="/camofduty/curso">Volver al curso</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="cod-certificate-page">
      <article className={`cod-certificate cod-certificate--${summary.medal}`}>
        <CamOfDutyLogo variant="header" />
        <p className="cod-certificate__kicker">Certificado de aprobación</p>
        <h1 className="cod-certificate__name">{name}</h1>
        <p className="cod-certificate__text">
          completó el <strong>Curso de fotografía Cam Of Duty — {level.title}</strong>, aprobando las {summary.total} lecciones con sus tareas prácticas en los simuladores, con {summary.stars} de {summary.maxStars} estrellas.
        </p>
        {summary.medal !== "ninguna" ? <p className="cod-certificate__medal">Medalla de {MEDAL[summary.medal]}</p> : null}
        <p className="cod-certificate__date">{date}</p>
      </article>
      <div className="cod-certificate-page__actions">
        <PrintButton />
        <Link href="/camofduty/curso" className="cod-btn cod-btn--ghost">
          Volver al curso
        </Link>
      </div>
    </main>
  );
}
