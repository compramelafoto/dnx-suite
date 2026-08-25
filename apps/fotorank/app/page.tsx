import { LandingHeader } from "./components/landing/LandingHeader";
import { PhotoBanner } from "./components/landing/PhotoBanner";
import { canAccessFotorankOrganizerDashboard, getAuthUser } from "./lib/auth";
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
import { listPublicHomeContests } from "./lib/fotorank/publicContests";
import { FotorankHomePartnerWelcome } from "./components/partners/FotorankHomePartnerWelcome";
import { FotorankPartnerLogoMarquee } from "./components/partners/FotorankPartnerLogoMarquee";
import {
  loadFotorankHomeWelcomeAd,
  toFotorankHomeWelcomePublicPayload,
} from "./lib/fotorank/partners/home-welcome";
import {
  FOTORANK_HOME_MARQUEE_TITLE,
  loadFotorankHomeMarqueeAds,
  toFotorankMarqueePublicItems,
} from "./lib/fotorank/partners/home-marquee";

export default async function Home() {
  const [admin, judge] = await Promise.all([getAuthUser(), getJudgeAuthUser()]);
  const publicContests = await listPublicHomeContests(6);
  const hasFotorankAdminSession = await canAccessFotorankOrganizerDashboard(admin);

  // Inventario global de la plataforma. Con las flags en OFF no se consulta
  // nada y ambos resuelven vacío.
  const [welcomeAd, marqueeAds] = await Promise.all([
    loadFotorankHomeWelcomeAd({ pathname: "/" }),
    loadFotorankHomeMarqueeAds(),
  ]);
  const marqueeItems = toFotorankMarqueePublicItems(marqueeAds);

  return (
    <ReducedMotionWrapper>
      <div className="min-h-screen fr-bg">
        <FotorankHomePartnerWelcome
          ad={welcomeAd ? toFotorankHomeWelcomePublicPayload(welcomeAd) : null}
        />
        <LandingHeader hasAdminSession={hasFotorankAdminSession} hasJudgeSession={Boolean(judge)} />
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
          <FeaturedContestsSection contests={publicContests} />
          {marqueeItems.length > 0 ? (
            <FotorankPartnerLogoMarquee
              title={FOTORANK_HOME_MARQUEE_TITLE}
              titleId="fotorank-home-marquee-title"
              items={marqueeItems}
            />
          ) : null}
          <FinalCTASection />
        </main>
        <Footer />
      </div>
    </ReducedMotionWrapper>
  );
}
