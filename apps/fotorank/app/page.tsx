import { LandingHeader } from "./components/landing/LandingHeader";
import { PhotoBanner } from "./components/landing/PhotoBanner";
import { getAuthUser } from "./lib/auth";
import { getJudgeAuthUser } from "./lib/judge-auth";
import { HeroSection } from "./components/landing/HeroSection";
import { ProblemSection } from "./components/landing/ProblemSection";
import { HowItWorksSection } from "./components/landing/HowItWorksSection";
import { BenefitsSection } from "./components/landing/BenefitsSection";
import { ParaQuienEsSection } from "./components/landing/ParaQuienEsSection";
import { CredibilidadSection } from "./components/landing/CredibilidadSection";
import { FeaturedContestsSection } from "./components/landing/FeaturedContestsSection";
import { FinalCTASection } from "./components/landing/FinalCTASection";
import { Footer } from "./components/landing/Footer";
import { ReducedMotionWrapper } from "./components/landing/ReducedMotionWrapper";

export default async function Home() {
  const [admin, judge] = await Promise.all([getAuthUser(), getJudgeAuthUser()]);

  return (
    <ReducedMotionWrapper>
      <div className="min-h-screen fr-bg">
        <LandingHeader hasAdminSession={Boolean(admin)} hasJudgeSession={Boolean(judge)} />
        {/* Reserva altura bajo header fijo (relaxed + franja logo sidebar); alinear con `HeaderContainer` relaxedHeight. */}
        <div className="min-h-[6.25rem] w-full shrink-0 bg-[#050505] py-2 md:min-h-[7rem] md:py-2.5" aria-hidden />
        <PhotoBanner />
        <main className="mx-auto w-full max-w-[100rem]">
          <HeroSection />
          <ProblemSection />
          <HowItWorksSection />
          <BenefitsSection />
          <ParaQuienEsSection />
          <CredibilidadSection />
          <FeaturedContestsSection />
          <FinalCTASection />
        </main>
        <Footer />
      </div>
    </ReducedMotionWrapper>
  );
}
