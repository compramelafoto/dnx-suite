import type { Metadata } from "next";
import CommunityAltaFormLoader from "@/components/community/CommunityAltaFormLoader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alta en directorio Proveedores | ComprameLaFoto",
  description: "Completá tus datos para aparecer en el directorio de proveedores de eventos.",
};

export default function AltaProveedoresPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <CommunityAltaFormLoader
        type="EVENT_VENDOR"
        title="Alta en directorio Proveedores"
        subtitle="Completá tus datos para aparecer en el directorio de proveedores de eventos (makeup, DJ, catering, vestidos, etc.)."
        partnerName="DNX estudio 2"
        partnerLogoUrl="/images/dnx-estudio-2-logo.png"
      />
    </main>
  );
}
