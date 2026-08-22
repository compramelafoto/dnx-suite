import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

/**
 * Destino de los enlaces de la campaña [DEMO COMERCIAL] DNX Partners.
 *
 * Existe para que el clic en una creatividad termine en una página real y se
 * pueda capturar el redirect `/r/[trackingKey]` andando. No se publica: en
 * producción responde 404.
 */

export const metadata: Metadata = {
  title: "Demostración comercial · DNX Partners",
  description: "Página de destino de las campañas de demostración de DNX Partners.",
  robots: { index: false, follow: false },
};

const BRANDS = [
  {
    slug: "demo-comercial-clickaton",
    name: "Clickatón",
    file: "/partners-demo/clickaton.png",
    role: "Placa de bienvenida, banner y franja de logos en InfoSpot",
  },
  {
    slug: "demo-comercial-fotorank",
    name: "FotoRank",
    file: "/partners-demo/fotorank.png",
    role: "Placa de bienvenida en Clickatón y franja de logos",
  },
  {
    slug: "demo-comercial-compramelafoto",
    name: "ComprameLaFoto",
    file: "/partners-demo/compramelafoto.png",
    role: "Placa de bienvenida en FotoRank y franja de logos",
  },
  {
    slug: "demo-comercial-infospot",
    name: "InfoSpot",
    file: "/partners-demo/infospot.png",
    role: "Franja de logos en Clickatón y ComprameLaFoto",
  },
  {
    slug: "demo-comercial-fotoffice",
    name: "FotoOffice",
    file: "/partners-demo/fotoffice.png",
    role: "Placa de bienvenida, banner y franja de logos en ComprameLaFoto",
  },
] as const;

type Props = { searchParams?: Promise<{ marca?: string }> };

export default async function DemoPartnersPage({ searchParams }: Props) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = searchParams ? await searchParams : {};
  const origen = BRANDS.find((b) => b.slug === params.marca?.trim());

  return (
    <Section aria-labelledby="demo-partners-title">
      <Container className="max-w-3xl">
        <Badge variant="neutral">Demostración</Badge>
        <SectionHeader
          eyebrow="DNX Partners"
          title={
            origen
              ? `Llegaste desde el aviso de ${origen.name}`
              : "Llegaste desde una campaña de demostración"
          }
          description="Este es el destino de los enlaces de la campaña [DEMO COMERCIAL] DNX Partners. Si estás viendo esta página, el enlace con seguimiento funcionó: el clic pasó por /r/[clave], quedó registrado y te trajo hasta acá."
          titleId="demo-partners-title"
        />

        <Card variant="outlined" className="mt-10">
          <p className="ck-heading-md">Promoción cruzada del ecosistema</p>
          <p className="ck-body-sm mt-3 text-ck-text-secondary">
            Las cinco marcas de la demostración son las plataformas de DNX anunciándose
            entre sí. Ninguna aparece dentro de su propia app.
          </p>
          <ul className="mt-6 grid gap-5">
            {BRANDS.map((brand) => (
              <li
                key={brand.slug}
                className={
                  origen?.slug === brand.slug
                    ? "flex flex-wrap items-center gap-4 rounded-lg bg-ck-surface-raised p-3"
                    : "flex flex-wrap items-center gap-4 p-3"
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brand.file}
                  alt={brand.name}
                  className="h-12 w-auto max-w-[13rem] object-contain"
                />
                <span className="ck-body-sm text-ck-text-muted">{brand.role}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card variant="outlined" className="mt-6">
          <p className="ck-heading-md">Esta página no llega a producción</p>
          <p className="ck-body-sm mt-3 text-ck-text-secondary">
            Responde 404 cuando <code>NODE_ENV</code> vale <code>production</code>, y está
            marcada como no indexable.
          </p>
        </Card>
      </Container>
    </Section>
  );
}
