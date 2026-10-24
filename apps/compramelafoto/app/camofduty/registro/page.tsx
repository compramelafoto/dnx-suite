import type { Metadata } from "next";
import { Suspense } from "react";
import RegisterForm from "@/components/camofduty/access/RegisterForm";
import "@/styles/camofduty/acceso.css";

export const metadata: Metadata = {
  title: "Registrate gratis — Cam Of Duty",
  description: "Creá tu cuenta de fotógrafo y entrá al simulador fotográfico y al estudio de luz de Cam Of Duty.",
};

export default function CamOfDutyRegistroPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
