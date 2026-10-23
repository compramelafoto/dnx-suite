import type { Metadata } from "next";
import { requireCamOfDutyUser } from "@/lib/simulator/cam-of-duty-access";
import StudioLightClient from "@/components/simulator/studio-light/StudioLightClient";
import "@/styles/camofduty/estudio.css";

const title = "Estudio de luz — Cam Of Duty";
const description =
  "Armá un set de luces en 3D: arrastrá flashes, softbox y reflectores alrededor del modelo, medí con el fotómetro y aprendé los esquemas clásicos de retrato.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website", locale: "es_AR" },
};

/** Uso libre, pero con cuenta: depende de la sesión de cada visitante. */
export const dynamic = "force-dynamic";

export default async function CamOfDutyEstudioPage() {
  await requireCamOfDutyUser("/camofduty/estudio");
  return <StudioLightClient />;
}
