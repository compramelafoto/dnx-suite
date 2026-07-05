import Link from "next/link";
import Image from "next/image";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewReveal from "@/components/home-preview/PreviewReveal";
import { POPULAR_CATEGORIES } from "@/components/home-preview/popular-categories";
import { cn } from "@/lib/utils";

function CategoryCard({
  label,
  href,
  image,
  gridClass,
  heightClass,
}: (typeof POPULAR_CATEGORIES)[number]) {
  return (
    <li className={cn("min-w-0", gridClass)}>
      <Link
        href={href}
        className={cn(
          "hp-card group relative block w-full overflow-hidden rounded-2xl border border-[#e5e7eb]/80",
          "bg-[#e5e7eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d]/40 focus-visible:ring-offset-2",
          heightClass
        )}
      >
        <Image
          src={image}
          alt=""
          fill
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          sizes="(max-width: 768px) 50vw, 25vw"
          unoptimized
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#111827]/75 via-[#111827]/10 to-transparent pointer-events-none"
          aria-hidden
        />
        <span className="absolute bottom-3 left-3 right-3 sm:right-auto z-[1]">
          <span className="inline-block max-w-full truncate rounded-lg bg-[#111827]/55 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-[2px]">
            {label}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default function PopularCategoriesSection() {
  return (
    <PreviewSection id="categorias" variant="default" className="!py-12 md:!py-16 border-b border-[#f3f4f6]">
      <PreviewReveal className="w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 md:mb-10 w-full min-w-0">
          <div className="min-w-0 max-w-[min(100%,40rem)]">
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] m-0 tracking-tight">
              Categorías
            </h2>
            <p className="text-[#6b7280] text-base mt-2 mb-0 leading-relaxed">
              Encontrá eventos y álbumes por tipo de experiencia.
            </p>
          </div>
          <Link
            href="#proximos-eventos"
            className="shrink-0 text-sm font-medium text-[#c27b3d] hover:text-[#9a5f2f] transition-colors whitespace-nowrap"
          >
            Ver todas las categorías →
          </Link>
        </div>

        <ul
          className={cn(
            "grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4",
            "m-0 p-0 list-none w-full min-w-0"
          )}
        >
          {POPULAR_CATEGORIES.map((cat) => (
            <CategoryCard key={cat.id} {...cat} />
          ))}
        </ul>
      </PreviewReveal>
    </PreviewSection>
  );
}
