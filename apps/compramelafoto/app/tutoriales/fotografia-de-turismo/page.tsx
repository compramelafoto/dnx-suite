import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoursePage from "@/components/tutorials/CoursePage";
import { getTutorialCourse } from "@/lib/tutorials/courses";

export const dynamic = "force-dynamic";

const course = getTutorialCourse("turismo");

export const metadata: Metadata = {
  title: "Curso de fotografía de turismo | ComprameLaFoto",
  description: `${course?.tagline}. ${course?.lessonCount} clases cortas, sobre las pantallas reales: el álbum del paseo, los precios, la selfie, el QR y la venta.`,
  openGraph: {
    title: "Curso de fotografía de turismo | ComprameLaFoto",
    description: `${course?.tagline}. ${course?.lessonCount} clases cortas y gratis.`,
    type: "website",
    locale: "es_AR",
  },
};

export default function TurismoCoursePage() {
  if (!course) notFound();
  return <CoursePage course={course} />;
}
