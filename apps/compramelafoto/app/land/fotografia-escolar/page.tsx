import type { Metadata } from "next";
import HeroSection from "@/components/land/fotografia-escolar/HeroSection";
import ProblemSection from "@/components/land/fotografia-escolar/ProblemSection";
import AISearchSection from "@/components/land/fotografia-escolar/AISearchSection";
import PrivateGallerySection from "@/components/land/fotografia-escolar/PrivateGallerySection";
import TemplatesSection from "@/components/land/fotografia-escolar/TemplatesSection";
import SecuritySection from "@/components/land/fotografia-escolar/SecuritySection";
import HowItWorks from "@/components/land/fotografia-escolar/HowItWorks";
import BenefitsPhotographer from "@/components/land/fotografia-escolar/BenefitsPhotographer";
import BenefitsFamilies from "@/components/land/fotografia-escolar/BenefitsFamilies";
import BenefitsSchool from "@/components/land/fotografia-escolar/BenefitsSchool";
import FAQSection from "@/components/land/fotografia-escolar/FAQSection";
import CTASection from "@/components/land/fotografia-escolar/CTASection";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fotografía escolar - ComprameLaFoto | IA, privacidad y automatización",
  description:
    "Plataforma para fotógrafos escolares: organizá ventas, IA para identificar fotos por alumno, galerías privadas, plantillas automáticas. Privacidad y protección de datos.",
  openGraph: {
    title: "Fotografía escolar - ComprameLaFoto",
    description:
      "Organizá la venta de fotos escolares, automatizá la selección con IA y ofrecé una experiencia moderna y segura a las familias.",
  },
};

export default function FotografiaEscolarLandingPage() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <AISearchSection />
      <PrivateGallerySection />
      <TemplatesSection />
      <SecuritySection />
      <HowItWorks />
      <BenefitsPhotographer />
      <BenefitsFamilies />
      <BenefitsSchool />
      <FAQSection />
      <CTASection />
    </>
  );
}
