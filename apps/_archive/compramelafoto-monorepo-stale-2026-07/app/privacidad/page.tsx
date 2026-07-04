import type { Metadata } from "next";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { PRIVACY_SECTIONS, PRIVACY_SOLICITUD_URL } from "@/lib/privacy-policy-content";

export const metadata: Metadata = {
  title: "Política de Privacidad | ComprameLaFoto",
  description:
    "Política de privacidad de ComprameLaFoto. Información sobre recolección, uso y protección de datos personales. Cumplimiento AAIP.",
};

export default function PrivacidadPage() {
  return (
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a1a]">
              Política de Privacidad
            </h1>
            <p className="text-[#6b7280]">
              ComprameLaFoto respeta tu privacidad. Esta política describe cómo tratamos tus datos
              según la Ley 25.326 y normativa AAIP.
            </p>
          </div>

          {PRIVACY_SECTIONS.map((section) => (
            <Card key={section.id} className="p-6" id={section.id}>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">{section.title}</h2>
              <div
                className="prose prose-sm max-w-none text-[#1a1a1a] whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: section.content
                    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                    .replace(/\n/g, "<br />"),
                }}
              />
            </Card>
          ))}

          <Card className="p-6 bg-[#f7f5f2] border-[#c27b3d]/20">
            <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">
              Ejercer derechos / Solicitar acceso, rectificación o supresión
            </h2>
            <p className="text-[#6b7280] mb-4 text-sm">
              Si querés acceder a tus datos, rectificarlos, solicitar supresión, ocultar una foto o
              desactivar reconocimiento facial, completá el formulario.
            </p>
            <Link
              href="/privacidad/solicitud"
              className="inline-flex items-center px-4 py-2 bg-[#c27b3d] text-white rounded-lg hover:bg-[#a8682d] transition-colors text-sm font-medium"
            >
              Ir al formulario de solicitud →
            </Link>
          </Card>

          <div className="text-center pt-4">
            <Link href="/" className="text-sm text-[#6b7280] hover:text-[#1a1a1a]">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
