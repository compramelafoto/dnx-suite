import { Community } from "@/components/home/Community";
import { ConceptBlock } from "@/components/home/ConceptBlock";
import { FinalCta } from "@/components/home/FinalCta";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { UpcomingMarathons } from "@/components/home/UpcomingMarathons";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ConceptBlock />
      <UpcomingMarathons />
      <HowItWorks />
      <Community />
      <FinalCta />
    </>
  );
}
