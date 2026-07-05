"use client";

import HeroSection from "@/components/home-preview/HeroSection";
import PopularCategoriesSection from "@/components/home-preview/PopularCategoriesSection";
import UpcomingEventsSection from "@/components/home-preview/UpcomingEventsSection";
import AlbumsAvailableSection from "@/components/home-preview/AlbumsAvailableSection";
import PhotographerEventsSection from "@/components/home-preview/PhotographerEventsSection";
import EcosystemSection from "@/components/home-preview/EcosystemSection";
import HomePreviewFaq from "@/components/home-preview/HomePreviewFaq";
import FinalCtaSection from "@/components/home-preview/FinalCtaSection";

export default function HomePreviewContent() {
  return (
    <div className="min-h-screen bg-white w-full min-w-0 overflow-x-hidden">
      <HeroSection />
      <PopularCategoriesSection />
      <UpcomingEventsSection />
      <AlbumsAvailableSection />
      <PhotographerEventsSection />
      <EcosystemSection />
      <HomePreviewFaq />
      <FinalCtaSection />
    </div>
  );
}
