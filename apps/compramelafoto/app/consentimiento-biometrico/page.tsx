import type { Metadata } from "next";
import Link from "next/link";
import Card from "@/components/ui/Card";
import {
  BIOMETRIC_CONSENT_EFFECTIVE_DATE,
  BIOMETRIC_CONSENT_SECTIONS,
  BIOMETRIC_CONSENT_VERSION,
} from "@/lib/legal/biometric-consent-content";
import { formatLegalContent } from "@/lib/legal/format-legal-content";

export const metadata: Metadata = {
  title: "Consentimiento Biométrico | ComprameLaFoto",
  description:
    "Consentimiento informado para el tratamiento de datos biométricos y reconocimiento facial en ComprameLaFoto. Ley 25.326.",
};

const RELATED_LINKS = [
  { href: "/privacidad", label: "Política de Privacidad" },
  { href: "/privacidad/escuelas", label: "Política Escolar y Menores" },
  { href: "/privacidad/retencion", label: "Política de Retención y Eliminación" },
  { href: "/privacidad/solicitud", label: "Ejercer derechos / revocar biometría" },
] as const;

export default function ConsentimientoBiometricoPage() {
  return (
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a1a]">
              Consentimiento Biométrico
            </h1>
            <p className="text-[#6b7280]">
              Documento independiente para el tratamiento de datos biométricos y reconocimiento
              facial. Debe aceptarse además de la{" "}
              <Link href="/privacidad" className="text-[#c27b3d] hover:underline">
                Política de Privacidad
              </Link>{" "}
              cuando uses búsqueda por rostro o avisos con selfie.
            </p>
            <p className="text-sm text-[#9ca3af]">
              Versión {BIOMETRIC_CONSENT_VERSION} · Vigente desde {BIOMETRIC_CONSENT_EFFECTIVE_DATE}
            </p>
          </div>

          <Card className="p-6 bg-[#f7f5f2] border-[#c27b3d]/20">
            <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">Documentos relacionados</h2>
            <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-2">
              {RELATED_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-medium text-[#c27b3d] hover:text-[#a0662f] hover:underline"
                  >
                    {link.label} →
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {BIOMETRIC_CONSENT_SECTIONS.map((section) => (
            <Card key={section.id} className="p-6" id={section.id}>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">{section.title}</h2>
              <div
                className="prose prose-sm max-w-none text-[#1a1a1a] whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: formatLegalContent(section.content) }}
              />
            </Card>
          ))}

          <Card className="p-6 bg-[#f7f5f2] border-[#c27b3d]/20">
            <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">
              Revocar o eliminar datos biométricos
            </h2>
            <p className="text-[#6b7280] mb-4 text-sm">
              Podés revocar este consentimiento desde el formulario de solicitudes o el enlace del
              email de notificación.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/privacidad/solicitud"
                className="inline-flex items-center px-4 py-2 bg-[#c27b3d] text-white rounded-lg hover:bg-[#a8682d] transition-colors text-sm font-medium"
              >
                Formulario de solicitud →
              </Link>
              <Link
                href="/privacidad"
                className="inline-flex items-center px-4 py-2 border border-[#e5e7eb] text-[#1a1a1a] rounded-lg hover:bg-[#f9fafb] transition-colors text-sm font-medium"
              >
                Política de Privacidad
              </Link>
            </div>
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
