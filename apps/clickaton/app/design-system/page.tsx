import type { Metadata } from "next";
import { BrushStroke } from "@/components/brand/BrushStroke";
import { CoordinateGrid } from "@/components/brand/CoordinateGrid";
import { EditorialLabel } from "@/components/brand/EditorialLabel";
import { Logo } from "@/components/brand/Logo";
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
  title: "Design System V1 (interno)",
  description:
    "Catálogo interno del Design System V1 de Clickaton — identidad visual oficial.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

const primarySwatches = [
  { name: "Amarillo Clickaton", token: "brand-primary", className: "bg-ck-yellow", hex: "#FFC400" },
  { name: "Negro", token: "brand-ink", className: "bg-ck-black", hex: "#000000" },
  { name: "Blanco", token: "brand-paper", className: "bg-ck-white border border-ck-border", hex: "#FFFFFF" },
] as const;

const secondarySwatches = [
  { name: "Gris", token: "brand-gray", className: "bg-ck-gray-100", hex: "#F2F2F2" },
  { name: "Violeta Comunidad", token: "brand-violet", className: "bg-ck-violet", hex: "#6C53FF" },
  { name: "Azul Tecnología", token: "brand-blue", className: "bg-ck-blue", hex: "#00AEEF" },
  { name: "Verde Éxito", token: "brand-green", className: "bg-ck-green", hex: "#4CAF50" },
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

function SwatchGrid({
  items,
}: {
  items: readonly { name: string; token: string; className: string; hex: string }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((swatch) => (
        <div
          key={swatch.token}
          className="overflow-hidden rounded-[var(--ck-radius-md)] border-2 border-ck-border"
        >
          <div className={`h-20 ${swatch.className}`} />
          <div className="space-y-1 p-3">
            <p className="ck-label">{swatch.name}</p>
            <p className="ck-caption !text-ck-text-secondary">{swatch.token}</p>
            <p className="ck-mono text-ck-text-muted">{swatch.hex}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <>
      <Section tone="yellow" className="border-b-2 border-ck-border-strong">
        <Container>
          <p className="ck-overline text-ck-black">Etapa 01 · Interno</p>
          <h1 className="ck-display-lg mt-3 text-ck-black">Design System V1</h1>
          <p className="ck-body-md mt-4 max-w-[var(--ck-content-readable)] text-ck-black/80">
            Identidad visual oficial de Clickaton. Catálogo de desarrollo — no es una página
            pública de marketing. Ruta noindex, fuera de la navegación principal.
          </p>
          <p className="ck-accent-script mt-6 text-3xl text-ck-black md:text-4xl">
            Salí. Encontrá. Compartí.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="space-y-16">
          <CatalogBlock title="Logo oficial">
            <p className="ck-body-sm text-ck-text-secondary">
              Assets del Manual — no reinterpretar. Componente <code className="ck-mono">Logo</code>.
            </p>
            <div className="mt-6 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center gap-3 rounded-[var(--ck-radius-md)] border-2 border-ck-border bg-ck-white p-6">
                <Logo variant="horizontal" href={null} height={48} />
                <p className="ck-caption">Horizontal</p>
              </div>
              <div className="flex flex-col items-center gap-3 rounded-[var(--ck-radius-md)] border-2 border-ck-border bg-ck-white p-6">
                <Logo variant="vertical" href={null} height={120} />
                <p className="ck-caption">Vertical</p>
              </div>
              <div className="flex flex-col items-center gap-3 rounded-[var(--ck-radius-md)] border-2 border-ck-border bg-ck-black p-6">
                <Logo variant="principal" href={null} height={120} />
                <p className="ck-caption text-ck-gray-200">Principal (oscuro)</p>
              </div>
              <div className="flex flex-col items-center gap-3 rounded-[var(--ck-radius-md)] border-2 border-ck-border bg-ck-white p-6">
                <Logo variant="isotipoAmarillo" href={null} height={72} />
                <p className="ck-caption">Isotipo amarillo</p>
              </div>
              <div className="flex flex-col items-center gap-3 rounded-[var(--ck-radius-md)] border-2 border-ck-border bg-ck-white p-6">
                <Logo variant="mono" href={null} height={120} />
                <p className="ck-caption">Monocromático</p>
              </div>
              <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--ck-radius-md)] border-2 border-ck-border bg-ck-white p-6">
                <Wordmark href="/design-system" />
                <p className="ck-caption">Wordmark (chrome)</p>
              </div>
            </div>
          </CatalogBlock>

          <CatalogBlock title="Paleta primaria">
            <SwatchGrid items={primarySwatches} />
          </CatalogBlock>

          <CatalogBlock title="Paleta secundaria (estados)">
            <p className="ck-body-sm text-ck-text-secondary">
              Solo para estados del sistema y acentos controlados. No competir con el amarillo.
            </p>
            <div className="mt-4">
              <SwatchGrid items={secondarySwatches} />
            </div>
          </CatalogBlock>

          <CatalogBlock title="Tipografía">
            <Stack gap="lg">
              <div>
                <p className="ck-overline text-ck-text-muted">Display · Bebas Neue</p>
                <p className="ck-display-xl mt-2">Salí a buscar el instante</p>
                <p className="ck-display-lg mt-2">Maratón Fotográfica</p>
                <p className="ck-display-md mt-2">Comunidad y aprendizaje</p>
              </div>
              <div>
                <p className="ck-overline text-ck-text-muted">Heading</p>
                <p className="ck-heading-xl mt-2">Heading XL</p>
                <p className="ck-heading-lg mt-2">Heading LG</p>
                <p className="ck-heading-md mt-2">Heading MD</p>
                <p className="ck-heading-sm mt-2">Heading SM</p>
              </div>
              <div>
                <p className="ck-overline text-ck-text-muted">Body · Montserrat</p>
                <p className="ck-body-lg mt-2 text-ck-text-secondary">
                  Body LG — Una experiencia fotográfica que combina creatividad, desafío y
                  comunidad.
                </p>
                <p className="ck-body-md mt-2 text-ck-text-secondary">
                  Body MD — Texto de interfaz y lectura estándar.
                </p>
                <p className="ck-body-sm mt-2 text-ck-text-muted">
                  Body SM — Ayudas y notas secundarias.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <p className="ck-label">Label</p>
                  <p className="ck-caption mt-2">Caption — Nota editorial</p>
                  <p className="ck-overline mt-2">Overline</p>
                </div>
                <p className="ck-numeric-display">01:24</p>
                <p className="ck-mono">-32.9442° S · -60.6505° W</p>
                <p className="ck-accent-script text-3xl text-ck-black">Luz · Sombras · Texturas</p>
              </div>
            </Stack>
          </CatalogBlock>

          <CatalogBlock title="Botones">
            <div className="flex flex-wrap gap-3">
              <Button>Inscribirme</Button>
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
                <p className="ck-body-sm mt-2">Acento energético — usar con moderación.</p>
              </Card>
              <Card variant="dark">
                <p className="ck-heading-md text-ck-yellow">Dark</p>
                <p className="ck-body-sm mt-2 text-ck-gray-200">Fondo inverso puntual.</p>
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
            </div>
          </CatalogBlock>

          <CatalogBlock title="Recursos gráficos">
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="relative overflow-hidden rounded-[var(--ck-radius-md)] border-2 border-ck-border bg-ck-yellow p-8">
                <CoordinateGrid />
                <ViewfinderFrame className="relative z-[1] max-w-[16rem]" />
              </div>
              <Stack gap="lg">
                <EditorialLabel>Enfocar · Explorar · Compartir</EditorialLabel>
                <EditorialLabel tone="yellow">Yellow label</EditorialLabel>
                <EditorialLabel tone="dark">Dark label</EditorialLabel>
                <BrushStroke />
                <p className="ck-body-sm text-ck-text-muted">
                  Decorativos con aria-hidden. Nunca sustituyen al logo oficial. Usar con
                  moderación.
                </p>
              </Stack>
            </div>
          </CatalogBlock>
        </Container>
      </Section>

      <Section tone="muted" grain>
        <Container>
          <SectionHeader
            align="center"
            eyebrow="Principio"
            title="El amarillo es acento"
            description="Fondos luminosos. Contraste negro/blanco. Amarillo Clickaton para CTA y energía — no como color de relleno masivo."
          />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button>Inscribirme</Button>
            <Button variant="outline">Cómo funciona</Button>
            <Button variant="secondary">Ver maratones</Button>
          </div>
        </Container>
      </Section>

      <Section tone="dark">
        <Container>
          <SectionHeader
            align="center"
            eyebrow="Fondo negro"
            title="Contraste inverso"
            description="Bandas oscuras puntuales — nunca el modo default de la interfaz."
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
