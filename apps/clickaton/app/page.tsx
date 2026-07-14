import { BrandPillars } from "@/components/home/BrandPillars";
import { Community } from "@/components/home/Community";
import { ExperienceSteps } from "@/components/home/ExperienceSteps";
import { FAQList } from "@/components/home/FAQList";
import { FinalCta } from "@/components/home/FinalCta";
import { Hero } from "@/components/home/Hero";
import { LearningSection } from "@/components/home/LearningSection";
import { ManifestoBlock } from "@/components/home/ManifestoBlock";
import { PartnershipSection } from "@/components/home/PartnershipSection";
import { UpcomingEventsPlaceholder } from "@/components/home/UpcomingEventsPlaceholder";
import { VenueProgramSection } from "@/components/home/VenueProgramSection";
import { WhatIsClickaton } from "@/components/home/WhatIsClickaton";

export default function HomePage() {
  return (
    <>
      <Hero />
      <WhatIsClickaton />
      <BrandPillars />
      <ExperienceSteps />
      <UpcomingEventsPlaceholder />
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
