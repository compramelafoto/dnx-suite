import type { GalleryPricingSnapshot } from "@/lib/pricing/gallery-pricing-snapshot";

type GalleryPricingBandProps = {
  pricing: GalleryPricingSnapshot | null | undefined;
};

const BENEFIT_BULLETS = [
  "Alta resolución",
  "Sin marca de agua",
  "Vista previa protegida",
] as const;

export default function GalleryPricingBand({ pricing }: GalleryPricingBandProps) {
  if (!pricing?.showBand || pricing.kind !== "DIGITAL_UNIFORM") {
    return null;
  }

  return (
    <section
      className="mb-6 rounded-xl bg-[#faf9f7] px-4 py-4 sm:px-5 sm:py-5"
      aria-label="Información sobre fotos digitales"
    >
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-6">
          <h2 className="text-base font-semibold text-[#1a1a1a]">Fotos digitales</h2>
          <p className="text-lg font-semibold text-[#1a1a1a] leading-tight">
            {pricing.digitalUnitPriceLabel}{" "}
            <span className="text-sm font-medium text-[#4b5563]">por foto</span>
          </p>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1.5" role="list">
          {BENEFIT_BULLETS.map((item) => (
            <li
              key={item}
              className="flex items-center gap-1.5 text-sm text-[#374151]"
            >
              <span className="text-[#16a34a]" aria-hidden>
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>

        <p className="text-sm text-[#4b5563] leading-relaxed">
          Las vistas previas están protegidas para evitar copias no autorizadas.
        </p>

        {pricing.discountLabel ? (
          <div className="rounded-lg bg-white/80 px-3 py-2.5">
            <p className="text-sm font-medium text-[#1a1a1a]">Descuentos automáticos</p>
            <p className="text-sm text-[#4b5563] mt-0.5 leading-relaxed">{pricing.discountLabel}</p>
          </div>
        ) : null}

        {pricing.enablePrintedPhotos ? (
          <p className="text-sm text-[#4b5563] leading-relaxed">
            También podés elegir impresiones en el siguiente paso.
          </p>
        ) : null}
      </div>
    </section>
  );
}
