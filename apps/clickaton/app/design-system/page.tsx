import type { Metadata } from "next";
import { BrushStroke } from "@/components/brand/BrushStroke";
import { CoordinateGrid } from "@/components/brand/CoordinateGrid";
import { EditorialLabel } from "@/components/brand/EditorialLabel";
import { ViewfinderFrame } from "@/components/brand/ViewfinderFrame";
import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Stack } from "@/components/layout/Stack";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { FocusMark } from "@/components/ui/FocusMark";
import { IconFrame } from "@/components/ui/IconFrame";

export const metadata: Metadata = {
  title: "Design System (interno)",
  description: "Catálogo visual interno del Sistema de Diseño MVP de Clickaton.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

const swatches = [
  { name: "brand-primary", className: "bg-ck-yellow", hex: "#FFE600" },
  { name: "brand-ink", className: "bg-ck-black", hex: "#0A0A0A" },
  { name: "brand-paper", className: "bg-ck-white border border-ck-border", hex: "#FFFFFF" },
  { name: "surface-muted", className: "bg-ck-bg-alt", hex: "#F7F6F3" },
  { name: "brand-accent", className: "bg-ck-accent", hex: "#3B1F6E" },
  { name: "text-muted", className: "bg-ck-gray-500", hex: "#7A746A" },
] as const;

function CatalogBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Stack gap="md" className="scroll-mt-24">
      <h3 className="ck-heading-md border-b-2 border-ck-border pb-2">{title}</h3>
      {children}
    </Stack>
  );
}

export default function DesignSystemPage() {
  return (
    <>
      <Section tone="dark" className="border-b border-ck-border">
        <Container>
          <p className="ck-label text-ck-yellow">Referencia interna</p>
          <h1 className="ck-display-lg mt-3 text-ck-yellow">Design System MVP</h1>
          <p className="ck-body-md mt-4 max-w-[var(--ck-content-readable)] text-ck-gray-200">
            Catálogo de desarrollo. No es una página pública de marketing. Ruta noindex y
            fuera de la navegación principal.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="space-y-16">
          <CatalogBlock title="Paleta">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {swatches.map((swatch) => (
                <div key={swatch.name} className="overflow-hidden rounded-[var(--ck-radius-md)] border-2 border-ck-border">
                  <div className={`h-20 ${swatch.className}`} />
                  <div className="space-y-1 p-3">
                    <p className="ck-label">{swatch.name}</p>
                    <p className="ck-mono text-ck-text-muted">{swatch.hex}</p>
                  </div>
                </div>
              ))}
            </div>
          </CatalogBlock>

          <CatalogBlock title="Tipografía">
            <Stack gap="lg">
              <p className="ck-display-xl">Display XL — Salí a buscar el instante.</p>
              <p className="ck-display-lg">Display LG — Maratón Fotográfica</p>
              <p className="ck-display-md">Display MD — Comunidad y aprendizaje</p>
              <p className="ck-heading-xl">Heading XL</p>
              <p className="ck-heading-lg">Heading LG</p>
              <p className="ck-heading-md">Heading MD</p>
              <p className="ck-body-lg text-ck-text-secondary">
                Body LG — Una experiencia fotográfica que combina creatividad, desafío y comunidad.
              </p>
              <p className="ck-body-md text-ck-text-secondary">
                Body MD — Texto de interfaz y lectura estándar.
              </p>
              <p className="ck-body-sm text-ck-text-muted">Body SM — Ayudas y notas secundarias.</p>
              <p className="ck-label">Label — Próximamente</p>
              <p className="ck-caption">Caption — Nota editorial</p>
              <p className="ck-numeric-display">01:24</p>
              <p className="ck-mono">coord 34.6037 · 58.3816</p>
            </Stack>
          </CatalogBlock>

          <CatalogBlock title="Botones">
            <div className="flex flex-wrap gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="text">Text link</Button>
              <Button disabled>Disabled</Button>
              <Button loading>Loading</Button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </CatalogBlock>

          <CatalogBlock title="Badges">
            <div className="flex flex-wrap gap-2">
              <Badge>Neutral</Badge>
              <Badge variant="brand">Próximamente</Badge>
              <Badge variant="accent">Comunidad</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="danger">Danger</Badge>
            </div>
          </CatalogBlock>

          <CatalogBlock title="Cards">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <p className="ck-heading-md">Default</p>
                <p className="ck-body-sm mt-2 text-ck-text-secondary">Superficie estándar.</p>
              </Card>
              <Card variant="outlined">
                <p className="ck-heading-md">Outlined</p>
                <p className="ck-body-sm mt-2 text-ck-text-secondary">Borde fuerte.</p>
              </Card>
              <Card variant="interactive">
                <p className="ck-heading-md">Interactive</p>
                <p className="ck-body-sm mt-2 text-ck-text-secondary">Hover con elevación.</p>
              </Card>
              <Card variant="yellow">
                <p className="ck-heading-md">Yellow</p>
                <p className="ck-body-sm mt-2">Acento energético.</p>
              </Card>
              <Card variant="dark">
                <p className="ck-heading-md text-ck-yellow">Dark</p>
                <p className="ck-body-sm mt-2 text-ck-gray-200">Fondo inverso.</p>
              </Card>
            </div>
          </CatalogBlock>

          <CatalogBlock title="Layout">
            <SectionHeader
              eyebrow="Ejemplo"
              title="SectionHeader"
              description="Eyebrow, título y descripción con ancho legible."
            />
            <Divider className="my-6" />
            <div className="flex flex-wrap items-center gap-4">
              <IconFrame tone="yellow">
                <FocusMark size="sm" />
              </IconFrame>
              <IconFrame tone="dark">
                <span className="ck-label text-ck-yellow">01</span>
              </IconFrame>
              <FocusMark size="lg" className="text-ck-black" />
              <Wordmark href="/design-system" />
            </div>
          </CatalogBlock>

          <CatalogBlock title="Recursos gráficos">
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="relative overflow-hidden rounded-[var(--ck-radius-md)] border-2 border-ck-border bg-ck-yellow p-8">
                <CoordinateGrid />
                <ViewfinderFrame className="relative z-[1] max-w-[16rem]" />
              </div>
              <Stack gap="lg">
                <EditorialLabel>Editorial label</EditorialLabel>
                <EditorialLabel tone="yellow">Yellow label</EditorialLabel>
                <EditorialLabel tone="dark">Dark label</EditorialLabel>
                <BrushStroke />
                <p className="ck-body-sm text-ck-text-muted">
                  Decorativos con aria-hidden. No son logo oficial.
                </p>
              </Stack>
            </div>
          </CatalogBlock>
        </Container>
      </Section>

      <Section tone="yellow" grain>
        <Container>
          <SectionHeader
            align="center"
            eyebrow="Fondo amarillo"
            title="Contraste sobre brand"
            description="Botones y tipografía deben permanecer legibles sobre el amarillo de marca."
          />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
          </div>
        </Container>
      </Section>

      <Section tone="dark">
        <Container>
          <SectionHeader
            align="center"
            eyebrow="Fondo negro"
            title="Contraste inverso"
            description="CTA y badges sobre superficie oscura."
            className="[&_.ck-label]:text-ck-yellow [&_h2]:text-ck-yellow [&_p]:text-ck-gray-200"
          />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button>Primary</Button>
            <Badge variant="brand">Maratón Fotográfica</Badge>
            <Badge variant="accent">Comunidad</Badge>
          </div>
        </Container>
      </Section>
    </>
  );
}
