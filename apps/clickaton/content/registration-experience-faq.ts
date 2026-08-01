import { homeContent } from "@/content/home";
import { howItWorksPageContent } from "@/content/how-it-works";

/**
 * FAQ de inscripción: reutiliza respuestas oficiales (home / cómo funciona).
 * No inventa políticas nuevas.
 */
function findHomeFaq(questionIncludes: string): string | null {
  const item = homeContent.faq.items.find((i) =>
    i.question.toLowerCase().includes(questionIncludes.toLowerCase()),
  );
  return item?.answer ?? null;
}

const cellularAnswer =
  findHomeFaq("celular") ??
  howItWorksPageContent.faq.find((i) => i.question.toLowerCase().includes("celular"))
    ?.answer ??
  "Depende de los dispositivos habilitados en esa Clickatón.";

const experienceAnswer =
  findHomeFaq("profesional") ??
  "No. Clickatón está pensado para distintos niveles. Cada edición podrá definir categorías o modalidades específicas en sus bases.";

const juryAnswer =
  findHomeFaq("evaluadas") ??
  "Sí. La evaluación forma parte del recorrido. Los criterios y el perfil del jurado se publicarán por edición.";

const uploadAnswer =
  howItWorksPageContent.phases.find((p) => p.title.toLowerCase().includes("carga"))?.body ??
  "Elegís tus imágenes y las entregás para formar parte de la evaluación.";

const winnersAnswer =
  howItWorksPageContent.phases.find((p) => p.title.toLowerCase().includes("resultados"))
    ?.body ?? "Los resultados se comunican por los canales oficiales de la edición.";

export const registrationExperienceFaq = {
  title: "Preguntas frecuentes",
  items: [
    {
      question: "¿Qué pasa si llueve?",
      answer:
        "Las decisiones operativas ante clima adverso se comunican por los canales oficiales de cada edición. Revisá las bases y los avisos del día del evento.",
    },
    {
      question: "¿Puedo participar con celular?",
      answer: cellularAnswer,
    },
    {
      question: "¿Necesito experiencia previa?",
      answer: experienceAnswer,
    },
    {
      question: "¿Cómo entrego las fotografías?",
      answer: uploadAnswer,
    },
    {
      question: "¿Cómo funciona el jurado?",
      answer: juryAnswer,
    },
    {
      question: "¿Cuándo se anuncian los ganadores?",
      answer: winnersAnswer,
    },
  ],
} as const;
