"use client";

import { useParams } from "next/navigation";
import { LabConfigPageContent } from "../page";

const VALID_SECTIONS = ["datos", "diseno", "mercadopago", "descuentos", "referidos", "upselling"];

export default function LabConfigSectionPage() {
  const params = useParams();
  const section = typeof params?.section === "string" ? params.section : "datos";

  if (!VALID_SECTIONS.includes(section)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-[#6b7280]">Sección no válida. Redirigiendo...</p>
      </div>
    );
  }

  return <LabConfigPageContent section={section} />;
}
