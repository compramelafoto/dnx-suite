import { notFound } from "next/navigation";
import {
  BrandMark,
  BRAND_MARK_VARIANTS,
  type BrandMarkVariant,
} from "@/components/brand/BrandMark";
import {
  ArticleCard,
  ArticleCardCompact,
  ArticleCardFeatured,
  ArticleCardHorizontal,
  ArticleMetadata,
  Breadcrumbs,
  CategoryBadge,
  EditorialImage,
  EmptyState,
  Pagination,
  SectionHeader,
  ShareActions,
} from "@/components/editorial";
import {
  EditorialContainer,
  Section,
  SectionDivider,
  Stack,
} from "@/components/foundations";
import {
  canAccessInfoSpotAdmin,
  getInfoSpotAccessContext,
} from "@/lib/infospot-access";

export const metadata = {
  title: "Design System",
  robots: { index: false, follow: false },
};

async function assertDesignSystemAccess() {
  if (process.env.NODE_ENV === "development") return;

  const access = await getInfoSpotAccessContext();
  const allowed =
    access?.subject &&
    (access.subject.isSuperAdmin ||
      access.subject.role === "INFOSPOT_DIRECTOR" ||
      canAccessInfoSpotAdmin(access.subject));

  if (!allowed) notFound();
}

const demoImage =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#eef0f3"/><stop offset="1" stop-color="#d5dae3"/>
      </linearGradient></defs>
      <rect width="1200" height="750" fill="url(#g)"/>
      <text x="60" y="680" font-family="system-ui,sans-serif" font-size="42" fill="#6b7380">Info Spot · foto editorial</text>
    </svg>`,
  );

const sampleCard = {
  title: "La final se definió en los penales bajo la lluvia",
  excerpt:
    "Una cobertura con ritmo de estadio, foco en las personas y respeto por el crédito fotográfico.",
  href: "/noticias",
  imageUrl: demoImage,
  imageAlt: "Demo editorial",
  category: "Deportes",
  categorySlug: "deportes",
  publishedAt: new Date("2026-07-01"),
  authorName: "Redacción Info Spot",
  location: "Buenos Aires",
};

const brandVariants: Array<{
  variant: BrandMarkVariant;
  label: string;
  note: string;
  dark?: boolean;
}> = [
  {
    variant: "horizontal",
    label: "Horizontal",
    note: "Header / footer · fondos claros",
  },
  {
    variant: "positive",
    label: "Positive",
    note: "Alias de horizontal para fondos claros",
  },
  {
    variant: "isotipo",
    label: "Isotipo",
    note: "Nav móvil / favicon / compactos",
  },
  {
    variant: "compact",
    label: "Compact",
    note: "Isotipo a escala reducida",
  },
  {
    variant: "negative",
    label: "Negative",
    note: "Solo fondos oscuros puntuales",
    dark: true,
  },
];

function Swatch({ name, variable }: { name: string; variable: string }) {
  return (
    <div className="space-y-2">
      <div
        className="h-16 rounded-[var(--is-radius-md)] border border-[var(--is-border)]"
        style={{ background: `var(${variable})` }}
      />
      <p className="is-metadata">
        {name}
        <br />
        <code className="text-[0.7rem]">{variable}</code>
      </p>
    </div>
  );
}

export default async function DesignSystemPage() {
  await assertDesignSystemAccess();

  return (
    <div className="bg-[var(--is-bg)]">
      <div className="border-b border-[var(--is-border)] bg-[var(--is-accent-soft)]">
        <EditorialContainer className="py-4">
          <p className="is-label">Catálogo interno · no indexable</p>
          <p className="is-metadata mt-1">
            Visible en development o para DIRECTOR / admin Info Spot. Header y
            footer del shell global quedan activos arriba y abajo.
          </p>
        </EditorialContainer>
      </div>

      <Section spacing="lg">
        <EditorialContainer>
          <Stack gap={16}>
            <header className="max-w-3xl space-y-3">
              <p className="is-eyebrow">Info Spot</p>
              <h1 className="is-display-l">Design System</h1>
              <p className="is-lead">
                Identidad oficial PNG, foundations y componentes editoriales
                base.
              </p>
            </header>

            <section className="space-y-6">
              <SectionHeader
                title="Marca oficial"
                eyebrow="Brand"
                description="PNG en /public/brand · sin placeholders tipográficos."
              />
              <div className="grid gap-4 md:grid-cols-2">
                {brandVariants.map((item) => (
                  <div
                    key={item.variant}
                    className={`rounded-[var(--is-radius-lg)] border border-[var(--is-border)] p-6 ${
                      item.dark
                        ? "bg-[var(--is-graphite-900)]"
                        : "bg-[var(--is-bg)]"
                    }`}
                  >
                    <p
                      className={`is-eyebrow mb-4 ${
                        item.dark ? "text-[var(--is-gray-400)]" : ""
                      }`}
                    >
                      {item.label}
                    </p>
                    <BrandMark variant={item.variant} href={null} />
                    <p
                      className={`is-metadata mt-4 ${
                        item.dark ? "text-[var(--is-gray-400)]" : ""
                      }`}
                    >
                      {item.note}
                      <br />
                      <code className="text-[0.7rem]">
                        {BRAND_MARK_VARIANTS[item.variant].src}
                      </code>
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-bg-secondary)] p-4">
                <p className="is-metadata">
                  Tokens de marca:{" "}
                  <code>--is-orange-500 = #f86000</code> ·{" "}
                  <code>--is-graphite-800 = #203038</code>
                </p>
              </div>
            </section>

            <SectionDivider />

            <section className="space-y-6">
              <SectionHeader title="Tipografía" eyebrow="Foundations" />
              <div className="space-y-4 rounded-[var(--is-radius-lg)] border border-[var(--is-border)] p-6 md:p-8">
                <p className="is-display-xl">Display XL</p>
                <p className="is-display-l">Display L</p>
                <p className="is-display-m">Display M</p>
                <p className="is-h1">Heading 1</p>
                <p className="is-h2">Heading 2</p>
                <p className="is-h3">Heading 3</p>
                <p className="is-h4">Heading 4</p>
                <p className="is-lead">Lead / bajada editorial</p>
                <p className="is-body-lg">Body large</p>
                <p className="is-body">Body</p>
                <p className="is-body-sm">Body small</p>
                <p className="is-caption">Caption</p>
                <p className="is-overline">Overline</p>
                <p className="is-eyebrow">Eyebrow</p>
                <p className="is-label">Label</p>
                <p className="is-button">Button</p>
                <p className="is-metadata">Metadata</p>
              </div>
            </section>

            <SectionDivider />

            <section className="space-y-6">
              <SectionHeader
                title="Colores"
                description="Escalas alineadas al logo oficial."
              />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                <Swatch name="BG" variable="--is-bg" />
                <Swatch name="BG secondary" variable="--is-bg-secondary" />
                <Swatch name="Text / Graphite 800" variable="--is-text" />
                <Swatch name="Muted" variable="--is-muted" />
                <Swatch name="Border" variable="--is-border" />
                <Swatch name="Accent / Orange 500" variable="--is-accent" />
                <Swatch name="Accent soft" variable="--is-accent-soft" />
                <Swatch name="Orange 500" variable="--is-orange-500" />
                <Swatch name="Graphite 800" variable="--is-graphite-800" />
                <Swatch name="Success" variable="--is-success" />
                <Swatch name="Warning" variable="--is-warning" />
                <Swatch name="Danger" variable="--is-danger" />
              </div>
            </section>

            <SectionDivider />

            <section className="space-y-6">
              <SectionHeader title="Spacing" description="Escala 4 → 160." />
              <div className="space-y-3">
                {[4, 8, 12, 16, 24, 32, 48, 64, 96, 120, 160].map((px) => (
                  <div key={px} className="flex items-center gap-4">
                    <span className="is-metadata w-16">{px}px</span>
                    <div
                      className="h-3 rounded-[var(--is-radius-sm)] bg-[var(--is-accent)]"
                      style={{ width: px }}
                    />
                  </div>
                ))}
              </div>
            </section>

            <SectionDivider />

            <section className="space-y-6">
              <SectionHeader
                title="Article cards"
                description="Cuatro variantes editoriales."
              />
              <ArticleCardFeatured {...sampleCard} />
              <div className="grid gap-6 md:grid-cols-2">
                <ArticleCard {...sampleCard} title="Card estándar con foto" />
                <ArticleCard
                  {...sampleCard}
                  title="Card sin imagen (fallback)"
                  imageUrl={null}
                />
              </div>
              <ArticleCardHorizontal
                {...sampleCard}
                title="Card horizontal con título largo que no debe cortarse de forma rígida en mobile ni desktop"
              />
              <div className="max-w-xl rounded-[var(--is-radius-md)] border border-[var(--is-border)] px-4">
                <ArticleCardCompact {...sampleCard} title="Compacta con thumb" />
                <ArticleCardCompact
                  {...sampleCard}
                  title="Compacta sin imagen"
                  imageUrl={null}
                />
              </div>
            </section>

            <SectionDivider />

            <section className="space-y-6">
              <SectionHeader title="Badges, metadata e imagen" />
              <div className="flex flex-wrap items-center gap-4">
                <CategoryBadge name="Cultura" slug="cultura" />
                <CategoryBadge name="Sin link" />
                <ArticleMetadata
                  date={new Date()}
                  location="CABA"
                  readingHint="4 min"
                />
              </div>
              <EditorialImage
                src={demoImage}
                alt="Demo"
                caption="Pie de foto de ejemplo"
                photographerName="Equipo Info Spot"
                aspectRatio="feature"
                priority
              />
              <Breadcrumbs
                items={[
                  { label: "Inicio", href: "/" },
                  { label: "Noticias", href: "/noticias" },
                  { label: "Nota de ejemplo" },
                ]}
              />
              <ShareActions
                title="Nota de ejemplo del design system"
                url="/design-system"
              />
              <Pagination page={2} hasNext basePath="/design-system" />
              <EmptyState
                title="Todavía no hay resultados"
                description="Estado vacío calmado, con CTA opcional."
                actionLabel="Ver noticias"
                actionHref="/noticias"
              />
            </section>
          </Stack>
        </EditorialContainer>
      </Section>
    </div>
  );
}
