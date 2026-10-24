import type { Metadata } from "next";
import { Suspense } from "react";
import CompleteForm from "@/components/camofduty/access/CompleteForm";
import "@/styles/camofduty/acceso.css";

export const metadata: Metadata = {
  title: "Completá tus datos — Cam Of Duty",
  robots: { index: false, follow: false },
};

export default function CamOfDutyCompletarPage() {
  return (
    <Suspense fallback={null}>
      <CompleteForm />
    </Suspense>
  );
}
