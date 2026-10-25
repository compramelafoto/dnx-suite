import type { Metadata } from "next";
import { requireCamOfDutyUser } from "@/lib/simulator/cam-of-duty-access";
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

/** Uso libre, pero con cuenta: depende de la sesión de cada visitante. */
export const dynamic = "force-dynamic";

export default async function CamOfDutySimuladorPage() {
  await requireCamOfDutyUser("/camofduty/simulador");
  return <SimulatorSimClient />;
}
