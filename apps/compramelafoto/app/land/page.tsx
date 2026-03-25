import type { Metadata } from "next";
import HomeBanner from "@/components/HomeBanner";
import HeroSection from "@/components/land/HeroSection";
import TargetSection from "@/components/land/TargetSection";
import ProblemSection from "@/components/land/ProblemSection";
import SolutionSection from "@/components/land/SolutionSection";
import HowItWorks from "@/components/land/HowItWorks";
import Benefits from "@/components/land/Benefits";
import SocialProof from "@/components/land/SocialProof";
import LandFAQ from "@/components/land/LandFAQ";
import CTASection from "@/components/land/CTASection";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ComprameLaFoto - Vendé tus fotos online de forma simple",
  description:
    "Publicá tus fotos, compartí tu galería y dejá que tus clientes compren y paguen solos. Sin desorden. Sin perseguir mensajes. Sin procesos manuales.",
  openGraph: {
    title: "ComprameLaFoto - Vendé tus fotos online de forma simple",
    description:
      "Publicá tus fotos, compartí tu galería y dejá que tus clientes compren y paguen solos.",
  },
};

export default function LandPage() {
  return (
    <>
      <HomeBanner />
      <HeroSection />
      <TargetSection />
      <ProblemSection />
      <SolutionSection />
      <HowItWorks />
      <Benefits />
      <SocialProof />
      <LandFAQ />
      <CTASection />
    </>
  );
}
