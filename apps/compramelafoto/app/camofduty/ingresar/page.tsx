import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/camofduty/access/LoginForm";
import "@/styles/camofduty/acceso.css";

export const metadata: Metadata = {
  title: "Ingresar — Cam Of Duty",
  robots: { index: false, follow: false },
};

export default function CamOfDutyIngresarPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
