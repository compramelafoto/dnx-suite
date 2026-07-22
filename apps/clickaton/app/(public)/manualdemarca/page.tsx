import type { Metadata } from "next";
import Image from "next/image";
import { BrandManualToc } from "@/components/brand-manual/BrandManualToc";
import { CopyHexButton } from "@/components/brand-manual/CopyHexButton";
import { PageHero } from "@/components/content/PageHero";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  brandCoreColors,
  brandFonts,
  brandLogoDownloads,
  brandManualMeta,
  brandPackDownloads,
  brandSupportColors,
  brandUsageRules,
} from "@/config/brand-manual";
import { routes } from "@/config/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { cn } from "@/lib/cn";

export const metadata: Metadata = buildPageMetadata({
  title: brandManualMeta.title,
  description: brandManualMeta.description,
  path: brandManualMeta.path,
});

function ManualSection({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div id={id} className={cn("scroll-mt-28 space-y-8", className)}>
      {children}
    </div>
  );
}

function ColorSwatchCard({
  name,
  role,
  hex,
  token,
}: {
  name: string;
  role: string;
  hex: string;
  token: string;
}) {
  const isLight = hex.toUpperCase() === "#FFFFFF";

  return (
    <Card className="overflow-hidden !p-0">
      <div
        className={cn(
          "h-28 border-b border-ck-border",
          isLight && "border border-ck-border",
        )}
        style={{ backgroundColor: hex }}
        aria-hidden
      />
      <div className="space-y-3 p-5">
        <div>
          <p className="ck-label text-ck-text">{name}</p>
          <p className="ck-caption mt-1 text-ck-text-secondary">{role}</p>
        </div>
        <p className="ck-mono text-ck-yellow">{hex}</p>
        <p className="ck-caption text-ck-text-muted">{token}</p>
        <CopyHexButton hex={hex} />
      </div>
    </Card>
  );
}

export default function BrandManualPage() {
  return (
    <>
      <SimpleBreadcrumb current="Manual de marca" />
      <PageHero
        eyebrow="Identidad visual · Sedes y diseñadores"
        title="Manual de marca"
        description="Todo lo que necesitás para comunicar Clickatón con coherencia: logos oficiales, colores, tipografías y reglas de uso. Descargá los archivos y usalos libremente en piezas de sedes, sponsors y comunidad."
      />

      <Section>
        <Container className="space-y-16 md:space-y-20">
          <BrandManualToc />

          <ManualSection id="logos">
            <SectionHeader
              eyebrow="01 · Marca"
              title="Logos principales"
              description="Tres variantes oficiales con fondo transparente. El preview usa damero solo en pantalla; al descargar recibís el PNG original sin modificar."
            />
            <div className="grid gap-8 lg:grid-cols-3">
              {brandLogoDownloads.map((logo) => (
                <Card key={logo.id} className="flex flex-col gap-6">
                  <div
                    className={cn(
                      "ck-transparency-checkerboard flex min-h-[14rem] items-center justify-center rounded-[var(--ck-radius-md)] border border-ck-border px-6 py-10",
                    )}
                  >
                    <Image
                      src={logo.previewSrc}
                      alt={logo.name}
                      width={1024}
                      height={logo.id === "principal-v2-mono" ? 682 : 485}
                      unoptimized
                      className="h-auto w-full max-w-sm bg-transparent object-contain"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-4">
                    <div>
                      <h3 className="ck-heading-md text-ck-text">{logo.name}</h3>
                      <p className="ck-body-sm mt-2 text-ck-text-secondary">
                        {logo.description}
                      </p>
                    </div>
                    <Button
                      href={logo.downloadHref}
                      download={logo.downloadFileName}
                      variant="primary"
                      className="w-fit"
                    >
                      Descargar PNG
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                href={brandPackDownloads.logosZip.href}
                download={brandPackDownloads.logosZip.fileName}
                variant="secondary"
              >
                {brandPackDownloads.logosZip.label}
              </Button>
            </div>
          </ManualSection>

          <ManualSection id="colores">
            <SectionHeader
              eyebrow="02 · Paleta"
              title="Colores de marca"
              description="Copiá el código hex con un clic. El amarillo es acento — nunca el fondo dominante."
            />
            <div>
              <h3 className="ck-heading-md mb-6 text-ck-text">Core</h3>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {brandCoreColors.map((c) => (
                  <ColorSwatchCard key={c.hex} {...c} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="ck-heading-md mb-6 text-ck-text">Apoyo / estados</h3>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {brandSupportColors.map((c) => (
                  <ColorSwatchCard key={c.hex} {...c} />
                ))}
              </div>
            </div>
          </ManualSection>

          <ManualSection id="tipografias">
            <SectionHeader
              eyebrow="03 · Tipografía"
              title="Familias tipográficas"
              description="Las mismas fuentes de la web. Descargá cada una o el pack completo. El wordmark del logo no se tipografía."
            />
            <div className="grid gap-8">
              {brandFonts.map((font) => (
                <Card key={font.id} className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <h3 className="ck-heading-md text-ck-text">{font.name}</h3>
                      <span className="ck-overline text-ck-yellow">{font.role}</span>
                    </div>
                    <p className={font.sampleClassName}>{font.sample}</p>
                    <p className="ck-body-sm text-ck-text-muted">{font.usage}</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                    <Button
                      href={font.downloadHref}
                      download={font.downloadFileName}
                      variant="primary"
                      size="sm"
                    >
                      Descargar
                    </Button>
                    <Button
                      href={font.googleFontsUrl}
                      variant="outline"
                      size="sm"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Google Fonts
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
            <Button
              href={brandPackDownloads.fontsZip.href}
              download={brandPackDownloads.fontsZip.fileName}
              variant="secondary"
              className="w-fit"
            >
              {brandPackDownloads.fontsZip.label}
            </Button>
          </ManualSection>

          <ManualSection id="uso">
            <SectionHeader
              eyebrow="04 · Reglas"
              title="Uso correcto"
              description="Para que sedes y diseñadores mantengan la misma energía visual en todo el ecosistema."
            />
            <div className="grid gap-8 md:grid-cols-2">
              <Card variant="yellow">
                <h3 className="ck-heading-md text-ck-yellow">Sí</h3>
                <ul className="mt-6 space-y-4">
                  {brandUsageRules.do.map((item) => (
                    <li key={item} className="ck-body-sm text-ck-text-secondary">
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card variant="outlined">
                <h3 className="ck-heading-md text-ck-text">No</h3>
                <ul className="mt-6 space-y-4">
                  {brandUsageRules.dont.map((item) => (
                    <li key={item} className="ck-body-sm text-ck-text-secondary">
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </ManualSection>

          <ManualSection id="packs">
            <SectionHeader
              eyebrow="05 · Descargas"
              title="Packs completos"
              description="Todo en un ZIP para armar piezas rápido."
            />
            <div className="flex flex-wrap gap-4">
              <Button
                href={brandPackDownloads.logosZip.href}
                download={brandPackDownloads.logosZip.fileName}
              >
                {brandPackDownloads.logosZip.label}
              </Button>
              <Button
                href={brandPackDownloads.fontsZip.href}
                download={brandPackDownloads.fontsZip.fileName}
                variant="secondary"
              >
                {brandPackDownloads.fontsZip.label}
              </Button>
              <Button href={routes.designSystem} variant="ghost">
                Ver Design System (interno)
              </Button>
            </div>
            <p className="ck-body-sm max-w-2xl text-ck-text-muted">
              Licencia tipográfica: SIL Open Font License (OFL) vía Google Fonts / Fontsource.
              Los logos son propiedad de Clickatón — usalos para comunicar la marca; no los
              alteres ni los registres como propios.
            </p>
          </ManualSection>
        </Container>
      </Section>
    </>
  );
}
