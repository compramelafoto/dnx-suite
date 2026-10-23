import type { Metadata } from "next";
import StudioLightClient from "@/components/simulator/studio-light/StudioLightClient";
import "@/styles/camofduty/estudio.css";
import { camOfDutyShareImage } from "../share-image";

const title = "Estudio de luz — Cam Of Duty";
const description =
  "Armá un set de luces en 3D: arrastrá flashes, softbox y reflectores alrededor del modelo, medí con el fotómetro y aprendé los esquemas clásicos de retrato.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    locale: "es_AR",
    siteName: "Cam Of Duty",
    url: "/camofduty/estudio",
    images: [camOfDutyShareImage],
  },
  twitter: { card: "summary_large_image", title, description, images: [camOfDutyShareImage] },
};

export default function CamOfDutyEstudioPage() {
  return <StudioLightClient />;
}
