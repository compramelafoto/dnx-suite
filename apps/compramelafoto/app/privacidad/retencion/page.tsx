import type { Metadata } from "next";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { formatLegalContent } from "@/lib/legal/format-legal-content";
import {
  RETENTION_POLICY_EFFECTIVE_DATE,
  RETENTION_POLICY_SECTIONS,
  RETENTION_POLICY_VERSION,
  RETENTION_TABLE_ROWS,
} from "@/lib/legal/retention-policy-content";

export const metadata: Metadata = {
  title: "Política de Retención y Eliminación | ComprameLaFoto",
  description:
    "Plazos de conservación y procedimientos de eliminación de datos en ComprameLaFoto.",
};

const RELATED_LINKS = [
  { href: "/privacidad", label: "Política de Privacidad" },
  { href: "/consentimiento-biometrico", label: "Consentimiento Biométrico" },
  { href: "/privacidad/escuelas", label: "Política Escolar y Menores" },
  { href: "/privacidad/solicitud", label: "Ejercer derechos ARCO" },
] as const;

export default function PrivacidadRetencionPage() {
  return (
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a1a]">
              Política de Retención y Eliminación de Datos
            </h1>
            <p className="text-[#6b7280]">
              Plazos de conservación por categoría de dato y procedimientos de eliminación. Complementa
              la{" "}
              <Link href="/privacidad" className="text-[#c27b3d] hover:underline">
                Política de Privacidad
              </Link>
              .
            </p>
            <p className="text-sm text-[#9ca3af]">
              Versión {RETENTION_POLICY_VERSION} · Vigente desde {RETENTION_POLICY_EFFECTIVE_DATE}
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

          {RETENTION_POLICY_SECTIONS[0] ? (
            <Card className="p-6" id={RETENTION_POLICY_SECTIONS[0].id}>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">
                {RETENTION_POLICY_SECTIONS[0].title}
              </h2>
              <div
                className="prose prose-sm max-w-none text-[#1a1a1a] whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: formatLegalContent(RETENTION_POLICY_SECTIONS[0].content),
                }}
              />
            </Card>
          ) : null}

          <Card className="p-6" id="tabla-retencion">
            <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">Tabla de retención</h2>
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full min-w-[40rem] text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e5e7eb]">
                    <th className="py-2 pr-3 font-semibold text-[#1a1a1a]">Categoría</th>
                    <th className="py-2 pr-3 font-semibold text-[#1a1a1a]">Ubicación</th>
                    <th className="py-2 pr-3 font-semibold text-[#1a1a1a]">Plazo activo</th>
                    <th className="py-2 font-semibold text-[#1a1a1a]">Eliminación</th>
                  </tr>
                </thead>
                <tbody>
                  {RETENTION_TABLE_ROWS.map((row) => (
                    <tr key={row.category} className="border-b border-[#f3f4f6] align-top">
                      <td className="py-3 pr-3 text-[#1a1a1a] font-medium">{row.category}</td>
                      <td className="py-3 pr-3 text-[#6b7280]">{row.location}</td>
                      <td
                        className="py-3 pr-3 text-[#6b7280]"
                        dangerouslySetInnerHTML={{
                          __html: formatLegalContent(row.activePeriod),
                        }}
                      />
                      <td className="py-3 text-[#6b7280]">{row.deletion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {RETENTION_POLICY_SECTIONS.slice(1).map((section) => (
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
