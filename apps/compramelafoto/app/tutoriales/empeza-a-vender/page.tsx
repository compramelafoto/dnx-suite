import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoursePage from "@/components/tutorials/CoursePage";
import { getTutorialCourse } from "@/lib/tutorials/courses";

export const dynamic = "force-dynamic";

const course = getTutorialCourse("empeza-a-vender");

export const metadata: Metadata = {
  title: "Empezá a vender en ComprameLaFoto | Curso para fotógrafos",
  description: `${course?.tagline}. ${course?.lessonCount} clases cortas, sobre las pantallas reales: la cuenta, Mercado Pago, el álbum, la venta y la entrega.`,
  openGraph: {
    title: "Empezá a vender en ComprameLaFoto | Curso para fotógrafos",
    description: `${course?.tagline}. ${course?.lessonCount} clases cortas y gratis.`,
    type: "website",
    locale: "es_AR",
  },
};

export default function EmpezaAVenderCoursePage() {
  if (!course) notFound();
  return <CoursePage course={course} />;
}
