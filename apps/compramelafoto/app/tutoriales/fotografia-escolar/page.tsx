import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoursePage from "@/components/tutorials/CoursePage";
import { getTutorialCourse } from "@/lib/tutorials/courses";

export const dynamic = "force-dynamic";

const course = getTutorialCourse("escolar");

export const metadata: Metadata = {
  title: "Curso de fotografía escolar | ComprameLaFoto",
  description: `${course?.tagline}. ${course?.lessonCount} clases cortas, sobre las pantallas reales: conseguir el colegio, la preventa, la toma, la producción y la entrega.`,
  openGraph: {
    title: "Curso de fotografía escolar | ComprameLaFoto",
    description: `${course?.tagline}. ${course?.lessonCount} clases cortas y gratis.`,
    type: "website",
    locale: "es_AR",
  },
};

export default function EscolarCoursePage() {
  if (!course) notFound();
  return <CoursePage course={course} />;
}
