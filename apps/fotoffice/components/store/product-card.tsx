import Link from "next/link";
import type { StoreProductCard } from "@/lib/store/storefront";
import { Price } from "./price";

/** Una tarjeta de la vitrina: foto cuadrada, nombre, precio (con talles, el más bajo) y si se agotó. */
export function ProductCard({ product, href }: { product: StoreProductCard; href: string }) {
  return (
    <Link href={href} className="group flex min-w-0 flex-col gap-3 rounded-[var(--fo-radius)] focus-visible:outline-2 focus-visible:outline-offset-4">
      <div
        className="relative aspect-square w-full overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)]"
        style={{ backgroundColor: "color-mix(in srgb, var(--fo-text) 5%, transparent)" }}
      >
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-[var(--fo-muted)]">
            {product.title}
          </span>
        )}
        {product.soldOut ? (
          <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2.5 py-1 text-xs font-medium text-white">
            Agotado
          </span>
        ) : null}
      </div>
      <div className="min-w-0 space-y-1">
        {product.categoryName ? (
          <p className="truncate text-xs uppercase tracking-wide text-[var(--fo-muted)]">{product.categoryName}</p>
        ) : null}
        <h2 className="line-clamp-2 text-sm font-medium leading-snug group-hover:underline group-hover:underline-offset-4">
          {product.title}
        </h2>
        <Price minor={product.fromPriceMinor} className="text-sm font-semibold" />
      </div>
    </Link>
  );
}
