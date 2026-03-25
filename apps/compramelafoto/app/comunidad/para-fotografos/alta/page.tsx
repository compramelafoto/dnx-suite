import type { Metadata } from "next";
import Link from "next/link";
import CommunityAltaFormLoader from "@/components/community/CommunityAltaFormLoader";
import HomeBanner from "@/components/HomeBanner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alta en directorio de servicios para fotógrafos | ComprameLaFoto",
  description: "Registrá tu empresa en el directorio interno de ComprameLaFoto. Servicios para fotógrafos: tiendas, educación, comunidades y más.",
};

const USO_DE_DATOS = (
  <>
    Los datos que completás se utilizarán exclusivamente para publicar tu ficha en el directorio interno de ComprameLaFoto. Fotógrafos y organizadores podrán ver tu nombre, contacto, ubicación y descripción para contactarte. No compartimos tus datos con terceros ni los usamos con fines de marketing sin tu consentimiento. Podés solicitar la baja o rectificación en cualquier momento desde nuestra{" "}
    <Link href="/privacidad" className="text-[#c27b3d] font-medium hover:underline">
      Política de Privacidad
    </Link>
    .
  </>
);

export default function AltaParaFotografosPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <HomeBanner />
      <main className="py-12 px-4">
        <div className="container-custom max-w-4xl mx-auto space-y-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium mb-2">¿Para qué usamos tus datos?</p>
            <p>{USO_DE_DATOS}</p>
          </div>
          <CommunityAltaFormLoader
            type="PHOTOGRAPHER_SERVICE"
            title="Alta en directorio interno de empresas que ofrecen servicios para fotógrafos"
            subtitle="Completá tus datos para aparecer en el directorio: tiendas, comunidades, educación, vestimenta, impresión y otros servicios pensados para fotógrafos."
            partnerName=""
            partnerLogoUrl=""
          />
        </div>
      </main>
    </div>
  );
}
