import type { Metadata } from "next";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { formatLegalContent } from "@/lib/legal/format-legal-content";
import {
  SCHOOL_PRIVACY_EFFECTIVE_DATE,
  SCHOOL_PRIVACY_SECTIONS,
  SCHOOL_PRIVACY_VERSION,
} from "@/lib/legal/school-privacy-content";

export const metadata: Metadata = {
  title: "Política Escolar y Menores | ComprameLaFoto",
  description:
    "Tratamiento de datos de menores, padrón escolar y preventa fotográfica en ComprameLaFoto. Ley 25.326.",
};

const RELATED_LINKS = [
  { href: "/privacidad", label: "Política de Privacidad" },
  { href: "/consentimiento-biometrico", label: "Consentimiento Biométrico" },
  { href: "/privacidad/retencion", label: "Política de Retención y Eliminación" },
  { href: "/privacidad/solicitud", label: "Ejercer derechos ARCO" },
] as const;

export default function PrivacidadEscuelasPage() {
  return (
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a1a]">
              Política Escolar y Tratamiento de Datos de Menores
            </h1>
            <p className="text-[#6b7280]">
              Complementa la{" "}
              <Link href="/privacidad" className="text-[#c27b3d] hover:underline">
                Política de Privacidad
              </Link>{" "}
              cuando se traten datos de alumnos, padrones escolares o preventas institucionales.
            </p>
            <p className="text-sm text-[#9ca3af]">
              Versión {SCHOOL_PRIVACY_VERSION} · Vigente desde {SCHOOL_PRIVACY_EFFECTIVE_DATE}
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

          {SCHOOL_PRIVACY_SECTIONS.map((section) => (
            <Card key={section.id} className="p-6" id={section.id}>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">{section.title}</h2>
              <div
                className="prose prose-sm max-w-none text-[#1a1a1a] whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: formatLegalContent(section.content) }}
              />
            </Card>
          ))}

          <div className="text-center pt-4">
            <Link href="/privacidad" className="text-sm text-[#6b7280] hover:text-[#1a1a1a]">
              ← Volver a Política de Privacidad
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
