"use client";

import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import AlbumWizardModal from "@/components/dashboard/albums/AlbumWizardModal";

export default function DashboardNewAlbumPage() {
  return (
    <>
      <PhotographerDashboardHeader photographer={null} />
      <main className="min-h-[calc(100vh-4rem)] bg-[#f9fafb]" aria-hidden />
      <AlbumWizardModal />
    </>
  );
}
