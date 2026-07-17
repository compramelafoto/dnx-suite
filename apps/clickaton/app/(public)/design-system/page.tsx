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
import { PhotoFrame } from "@/components/content/PhotoFrame";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { Field } from "@/components/ui/Field";
import { FocusMark } from "@/components/ui/FocusMark";
import { IconFrame } from "@/components/ui/IconFrame";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export const metadata: Metadata = {
  title: "Design System V2 (interno)",
  description:
    "Catálogo interno del Design System V2 de Clickaton — identidad editorial oscura.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

const primarySwatches = [
  { name: "Negro profundo", token: "core-black", className: "bg-ck-black", hex: "#111111" },
  { name: "Gris oscuro", token: "core-gray-dark", className: "bg-ck-gray-100", hex: "#1B1B1B" },
  { name: "Gris medio", token: "core-gray-mid", className: "bg-ck-gray-200", hex: "#2A2A2A" },
  {
    name: "Blanco",
    token: "core-white",
    className: "bg-ck-white border border-ck-border",
    hex: "#FFFFFF",
  },
  { name: "Texto secundario", token: "text-secondary", className: "bg-[#B9B9B9]", hex: "#B9B9B9" },
  { name: "Acento marca", token: "brand-primary", className: "bg-ck-yellow", hex: "#FFC400" },
] as const;

const secondarySwatches = [
  { name: "Violeta Comunidad", token: "brand-violet", className: "bg-ck-violet", hex: "#6C53FF" },
  { name: "Azul Tecnología", token: "brand-blue", className: "bg-ck-blue", hex: "#00AEEF" },
  { name: "Verde Éxito", token: "brand-green", className: "bg-ck-green", hex: "#4CAF50" },
  { name: "Peligro", token: "danger", className: "bg-[var(--ck-danger)]", hex: "#FF5C5C" },
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
      <h3 className="ck-heading-md border-b border-ck-border pb-3">{title}</h3>
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
          className="overflow-hidden rounded-[var(--ck-radius-md)] border border-ck-border bg-ck-surface"
        >
          <div className={`h-20 ${swatch.className}`} />
          <div className="space-y-1 p-3">
            <p className="ck-label text-ck-text">{swatch.name}</p>
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
      <Section
        tone="dark"
        grain
        className="ck-vignette border-b border-ck-border"
      >
        <Container className="relative z-[2] max-w-3xl py-8 md:py-14">
          <p className="ck-overline text-ck-yellow">Etapa 05 · Interno</p>
          <h1 className="ck-display-lg mt-4 text-ck-text">Design System V2</h1>
          <p className="ck-body-md mt-5 max-w-[var(--ck-content-readable)] text-ck-text-secondary">
            Identidad editorial oscura. El amarillo es un golpe visual — nunca el fondo. Catálogo
            de desarrollo (noindex).
          </p>
          <p className="ck-accent-script mt-8 text-2xl text-ck-text-secondary md:text-3xl">
            Salí. Encontrá. Compartí.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="space-y-20">
          <CatalogBlock title="Logo oficial">
            <p className="ck-body-sm text-ck-text-secondary">
              Assets del Manual — no reinterpretar. Componente <code className="ck-mono">Logo</code>.
            </p>
            <div className="mt-6 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center gap-3 rounded-[var(--ck-radius-md)] border border-ck-border bg-ck-surface p-6">
                <Logo variant="horizontal" href={null} height={48} />
                <p className="ck-caption">Horizontal</p>
              </div>
              <div className="flex flex-col items-center gap-3 rounded-[var(--ck-radius-md)] border border-ck-border bg-ck-surface p-6">
                <Logo variant="vertical" href={null} height={120} />
                <p className="ck-caption">Vertical</p>
              </div>
              <div className="flex flex-col items-center gap-3 rounded-[var(--ck-radius-md)] border border-ck-border bg-ck-bg p-6">
                <Logo variant="principal" href={null} height={120} />
                <p className="ck-caption">Principal</p>
              </div>
              <div className="flex flex-col items-center gap-3 rounded-[var(--ck-radius-md)] border border-ck-border bg-ck-surface p-6">
                <Logo variant="isotipoAmarillo" href={null} height={72} />
                <p className="ck-caption">Isotipo amarillo</p>
              </div>
              <div className="flex flex-col items-center gap-3 rounded-[var(--ck-radius-md)] border border-ck-border bg-ck-surface p-6">
                <Logo variant="horizontalMono" href={null} height={40} />
                <p className="ck-caption">Mono (chrome oscuro)</p>
              </div>
              <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--ck-radius-md)] border border-ck-border bg-ck-surface p-6">
                <Wordmark href={null} tone="inverse" />
                <p className="ck-caption">Wordmark inverse</p>
              </div>
            </div>
          </CatalogBlock>

          <CatalogBlock title="Core colors">
            <SwatchGrid items={primarySwatches} />
          </CatalogBlock>

          <CatalogBlock title="Semantic / estados">
            <p className="ck-body-sm text-ck-text-secondary">
              Solo estados del sistema. No compiten con el amarillo de marca.
            </p>
            <div className="mt-4">
              <SwatchGrid items={secondarySwatches} />
            </div>
          </CatalogBlock>

          <CatalogBlock title="Tipografía">
            <Stack gap="lg">
              <div>
                <p className="ck-overline text-ck-yellow">Display · Bebas Neue</p>
                <p className="ck-display-xl mt-2 text-ck-text">Salí a buscar el instante</p>
                <p className="ck-display-lg mt-2 text-ck-text">Maratón Fotográfica</p>
                <p className="ck-display-md mt-2 text-ck-text">Comunidad y aprendizaje</p>
              </div>
              <div>
                <p className="ck-overline text-ck-text-muted">Body · Montserrat</p>
                <p className="ck-body-lg mt-2">
                  Body LG — Una experiencia fotográfica que combina creatividad, desafío y
                  comunidad.
                </p>
                <p className="ck-body-md mt-2">Body MD — Texto de interfaz y lectura estándar.</p>
                <p className="ck-body-sm mt-2 text-ck-text-muted">
                  Body SM — Ayudas y notas secundarias.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-6">
                <p className="ck-numeric-display text-ck-yellow">01:24</p>
                <p className="ck-mono text-ck-text-muted">-32.9442° S · -60.6505° W</p>
                <p className="ck-accent-script text-3xl text-ck-text-secondary">
                  Luz · Sombras · Texturas
                </p>
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
          </CatalogBlock>

          <CatalogBlock title="Formularios">
            <div className="grid max-w-xl gap-5">
              <Field id="ds-name" label="Nombre" hint="Label visible; el placeholder no lo reemplaza." required>
                <Input placeholder="Tu nombre" />
              </Field>
              <Field id="ds-city" label="Ciudad">
                <Select defaultValue="">
                  <option value="" disabled>
                    Elegí una ciudad
                  </option>
                  <option>Rosario</option>
                  <option>Buenos Aires</option>
                </Select>
              </Field>
              <Field id="ds-message" label="Mensaje">
                <Textarea placeholder="Contanos..." />
              </Field>
              <Field id="ds-error" label="Con error" error="Este campo es obligatorio.">
                <Input placeholder="Campo con error" />
              </Field>
              <Field id="ds-disabled" label="Disabled">
                <Input placeholder="No editable" disabled />
              </Field>
            </div>
          </CatalogBlock>

          <CatalogBlock title="Superficies de sección">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[var(--ck-radius-md)] border border-ck-border bg-[var(--ck-surface-base)] p-5">
                <p className="ck-label text-ck-yellow">surface-base</p>
                <p className="ck-caption mt-2">Fondo página `#111`</p>
              </div>
              <div className="rounded-[var(--ck-radius-md)] border border-ck-border bg-[var(--ck-surface-raised)] p-5">
                <p className="ck-label text-ck-yellow">surface-raised</p>
                <p className="ck-caption mt-2">Banda alternada</p>
              </div>
              <div className="rounded-[var(--ck-radius-md)] border border-ck-border bg-[var(--ck-surface-band)] p-5">
                <p className="ck-label text-ck-yellow">surface-elevated / band</p>
                <p className="ck-caption mt-2">Sección elevada `#1B1B1B`</p>
              </div>
            </div>
          </CatalogBlock>

          <CatalogBlock title="Sistema fotográfico">
            <p className="ck-body-sm text-ck-text-secondary">
              Proporción guía: 70% superficies · 20% foto · 10% amarillo. Overlays negros únicamente.
              Fallbacks editoriales sin copy “placeholder” hacia el visitante.
            </p>
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <PhotoFrame
                variant="hero"
                alt="Variante hero"
                overlay="medium"
                eyebrow="hero"
                caption="Texto dominante + imagen secundaria"
                revealFallbackLabel
              />
              <PhotoFrame
                variant="editorial"
                alt="Variante editorial"
                overlay="soft"
                eyebrow="editorial"
                revealFallbackLabel
              />
              <PhotoFrame
                variant="card"
                alt="Variante card"
                overlay="soft"
                eyebrow="card"
                revealFallbackLabel
              />
              <PhotoFrame
                variant="portrait"
                alt="Variante portrait"
                overlay="soft"
                eyebrow="portrait"
                revealFallbackLabel
              />
              <PhotoFrame
                variant="gallery"
                alt="Variante gallery"
                overlay="none"
                eyebrow="gallery"
                revealFallbackLabel
              />
              <PhotoFrame
                variant="jury"
                alt="Variante jury"
                overlay="none"
                eyebrow="jury"
                className="max-w-[10rem]"
                revealFallbackLabel
              />
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <PhotoFrame variant="editorial" alt="" decorative overlay="soft" revealFallbackLabel caption="overlay soft" />
              <PhotoFrame variant="editorial" alt="" decorative overlay="medium" revealFallbackLabel caption="overlay medium" />
              <PhotoFrame variant="editorial" alt="" decorative overlay="strong" revealFallbackLabel caption="overlay strong" />
            </div>
            <PhotoFrame
              variant="editorial"
              alt="Ejemplo con crédito"
              overlay="soft"
              caption="Caption discreta sobre zona segura"
              credit="Archivo Clickatón"
              className="mt-8 max-w-xl"
              revealFallbackLabel
            />
          </CatalogBlock>

          <CatalogBlock title="Motion">
            <p className="ck-body-sm text-ck-text-secondary">
              Duraciones 180–340ms. Solo opacity / translateY / scale ≤ 1.02. Respetar{" "}
              <code className="ck-mono">prefers-reduced-motion</code>.
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              <Card variant="interactive" className="min-w-[12rem]">
                <p className="ck-label">Hover card</p>
                <p className="ck-caption mt-2">scale + elevación</p>
              </Card>
              <Button>Hover CTA</Button>
              <Button variant="secondary">Secondary</Button>
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <p className="ck-heading-md">Default</p>
                <p className="ck-body-sm mt-2">Superficie gris oscuro.</p>
              </Card>
              <Card variant="outlined">
                <p className="ck-heading-md">Outlined</p>
                <p className="ck-body-sm mt-2">Borde fino editorial.</p>
              </Card>
              <Card variant="interactive">
                <p className="ck-heading-md">Interactive</p>
                <p className="ck-body-sm mt-2">Hover lento + scale sutil.</p>
              </Card>
              <Card variant="yellow">
                <p className="ck-heading-md">Accent (yellow)</p>
                <p className="ck-body-sm mt-2">
                  Sin fill amarillo — borde superior de acento.
                </p>
              </Card>
              <Card variant="dark">
                <p className="ck-heading-md text-ck-yellow">Dark</p>
                <p className="ck-body-sm mt-2">Fondo más profundo.</p>
              </Card>
            </div>
          </CatalogBlock>

          <CatalogBlock title="Layout & marks">
            <SectionHeader
              eyebrow="Ejemplo"
              title="SectionHeader"
              description="Eyebrow, título y descripción con ancho legible."
            />
            <Divider className="my-8" />
            <div className="flex flex-wrap items-center gap-4">
              <IconFrame tone="yellow">
                <FocusMark size="sm" />
              </IconFrame>
              <IconFrame tone="dark" label="Paso 1">
                <span className="ck-label text-ck-yellow">01</span>
              </IconFrame>
              <FocusMark size="lg" className="text-ck-yellow" />
            </div>
          </CatalogBlock>

          <CatalogBlock title="Recursos gráficos">
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="relative overflow-hidden rounded-[var(--ck-radius-md)] border border-ck-border bg-ck-surface p-8">
                <CoordinateGrid />
                <ViewfinderFrame className="relative z-[1] max-w-[16rem]" />
              </div>
              <Stack gap="lg">
                <EditorialLabel>Enfocar · Explorar · Compartir</EditorialLabel>
                <EditorialLabel tone="yellow">Accent label</EditorialLabel>
                <EditorialLabel tone="dark">Dark label</EditorialLabel>
                <BrushStroke />
                <p className="ck-body-sm text-ck-text-muted">
                  Decorativos con aria-hidden. Nunca sustituyen al logo oficial.
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
            eyebrow="Principio V2"
            title="El amarillo es un golpe"
            description="Fondos oscuros. Contraste blanco/gris. Amarillo solo en CTA, links, líneas e indicadores."
          />
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button>Inscribirme</Button>
            <Button variant="secondary">Cómo funciona</Button>
            <Button variant="ghost">Ver maratones</Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
