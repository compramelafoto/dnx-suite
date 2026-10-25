import type { Metadata } from "next";
import { Suspense } from "react";
import VerifyForm from "@/components/camofduty/access/VerifyForm";
import "@/styles/camofduty/acceso.css";

export const metadata: Metadata = {
  title: "Validá tu email — Cam Of Duty",
  robots: { index: false, follow: false },
};

export default function CamOfDutyVerificarPage() {
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}
