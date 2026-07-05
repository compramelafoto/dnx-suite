import type { Metadata } from "next";
import SimulatorSimClient from "@/components/simulator/SimulatorSimClient";

const title = "Simulador — Cam Of Duty";
const description =
  "Simulador fotográfico interactivo con escena 3D navegable y parámetros de cámara en tiempo real.";

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
};

export default function CamOfDutySimuladorPage() {
  return <SimulatorSimClient />;
}
