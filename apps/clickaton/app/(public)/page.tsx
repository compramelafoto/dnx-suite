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
  let editions: Awaited<ReturnType<typeof listPublicMarathons>> = [];
  try {
    editions = await listPublicMarathons();
  } catch {
    editions = [];
  }
  const spotlightSlides = await buildHomeSpotlightSlides(editions);

  return (
    <>
      {spotlightSlides.length > 0 ? <HomeSpotlightBanner slides={spotlightSlides} /> : null}
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
