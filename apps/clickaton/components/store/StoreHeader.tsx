import { PageHero } from "@/components/content/PageHero";
import { Container } from "@/components/layout/Container";
import { storePageContent } from "@/content/store";

type StoreHeaderProps = {
  /** Slot reservado para banner futuro (sin implementar). */
  showBannerSlot?: boolean;
};

/**
 * Encabezado público de TIENDA + reserva de espacio para banner futuro.
 */
export function StoreHeader({ showBannerSlot = true }: StoreHeaderProps) {
  const { hero } = storePageContent;

  return (
    <>
      <PageHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        description={hero.description}
        titleId="store-page-title"
      />
      {showBannerSlot ? (
        <div className="border-b border-ck-border bg-ck-bg-alt/40" aria-hidden="true">
          <Container className="py-4 sm:py-5">
            {/* Espacio reservado: banner promocional de tienda (etapa futura). */}
            <div
              className="min-h-[4.5rem] rounded-[var(--ck-radius-md)] border border-dashed border-ck-border/80 bg-ck-surface/30 sm:min-h-[5.5rem]"
              data-store-banner-slot="reserved"
            />
          </Container>
        </div>
      ) : null}
    </>
  );
}
