import type { Metadata } from "next";
import SimulatorSimClient from "@/components/simulator/SimulatorSimClient";
import "@/styles/camofduty/simulador.css";

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
