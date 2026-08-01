import { BrandPillars } from "@/components/home/BrandPillars";
import { Community } from "@/components/home/Community";
import { ExperienceSteps } from "@/components/home/ExperienceSteps";
import { FAQList } from "@/components/home/FAQList";
import { FinalCta } from "@/components/home/FinalCta";
import { Hero } from "@/components/home/Hero";
import { HomeSpotlightBanner } from "@/components/home/HomeSpotlightBanner";
import { LearningSection } from "@/components/home/LearningSection";
import { ManifestoBlock } from "@/components/home/ManifestoBlock";
import { PartnershipSection } from "@/components/home/PartnershipSection";
import { UpcomingEventsSection } from "@/components/home/UpcomingEventsSection";
import { VenueProgramSection } from "@/components/home/VenueProgramSection";
import { WhatIsClickaton } from "@/components/home/WhatIsClickaton";
import { listPublicMarathons } from "@/data/public-marathons/service";
import { buildHomeSpotlightSlides } from "@/lib/home/build-spotlight-slides";

export default async function HomePage() {
  // Fallos de DB/fuente no se disfrazan como agenda vacía: van al error boundary.
  const editions = await listPublicMarathons();
  const spotlight = await buildHomeSpotlightSlides(editions);

  return (
    <>
      {spotlight.slides.length > 0 ? (
        <HomeSpotlightBanner slides={spotlight.slides} carousel={spotlight.carousel} />
      ) : null}
      <Hero />
      <WhatIsClickaton />
      <BrandPillars />
      <ExperienceSteps />
      <UpcomingEventsSection />
      <LearningSection />
      <Community />
      <VenueProgramSection />
      <PartnershipSection />
      <ManifestoBlock />
      <FAQList />
      <FinalCta />
    </>
  );
}
