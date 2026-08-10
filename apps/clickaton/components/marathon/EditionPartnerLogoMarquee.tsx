"use client";

type MarqueePartnerItem = {
  participationId: string;
  partnerName: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  displayTier: string;
};

/** Slots apaisados grandes para logos horizontales legibles. */
const TIER_SLOT: Record<string, string> = {
  INSTITUTIONAL: "h-24 w-[20rem] sm:h-28 sm:w-[24rem] md:h-32 md:w-[26rem]",
  MAIN: "h-20 w-[18rem] sm:h-24 sm:w-[22rem] md:h-28 md:w-[24rem]",
  STANDARD: "h-20 w-[16rem] sm:h-24 sm:w-[20rem] md:h-28 md:w-[22rem]",
  SUPPORTING: "h-20 w-[16rem] sm:h-24 sm:w-[18rem] md:h-24 md:w-[20rem]",
};

function partnerHref(websiteUrl: string | null): string | null {
  const href = websiteUrl?.trim() || null;
  if (!href) return null;
  if (href.startsWith("/r/") || href.startsWith("http") || href.startsWith("/")) return href;
  return `https://${href}`;
}

function MarqueeLogoCell({ item }: { item: MarqueePartnerItem }) {
  const alt = `Logo de ${item.partnerName}`;
  const slot = TIER_SLOT[item.displayTier] ?? TIER_SLOT.STANDARD;
  const href = partnerHref(item.websiteUrl);
  const logo = item.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.logoUrl}
      alt={alt}
      className="h-full w-full object-contain object-center"
    />
  ) : (
    <span className="px-2 text-center text-lg font-medium leading-snug text-ck-text sm:text-xl">
      {item.partnerName}
    </span>
  );

  const hoverName = item.logoUrl ? (
    <span
      className="pointer-events-none absolute inset-x-1 bottom-1 rounded-md bg-black/75 px-2 py-1.5 text-center text-xs font-medium leading-snug text-ck-text opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 sm:text-sm"
      aria-hidden
    >
      {item.partnerName}
    </span>
  ) : null;

  const boxClass = `group relative inline-flex shrink-0 items-center justify-center ${slot}`;

  if (!href) {
    return (
      <div className={boxClass} aria-label={alt} tabIndex={0}>
        {logo}
        {hoverName}
      </div>
    );
  }

  const isTracked = href.startsWith("/r/");

  return (
    // eslint-disable-next-line react/jsx-no-target-blank -- rel fijo con noreferrer
    <a
      href={href}
      target={isTracked ? undefined : "_blank"}
      rel={isTracked ? undefined : "noopener noreferrer"}
      className={`${boxClass} cursor-pointer text-inherit no-underline outline-none`}
      aria-label={alt}
    >
      {logo}
      {hoverName}
    </a>
  );
}

type EditionPartnerLogoMarqueeProps = {
  heading: string;
  items: MarqueePartnerItem[];
};

/** Marquee de logos (ck-marquee): sin labels de rol; nombre solo al hover. */
export function EditionPartnerLogoMarquee({
  heading,
  items,
}: EditionPartnerLogoMarqueeProps) {
  if (items.length === 0) return null;

  const loop = [...items, ...items];

  return (
    <div
      className="ck-marquee overflow-hidden py-4"
      role="region"
      aria-label={heading}
    >
      <div className="ck-marquee__track !gap-10 sm:!gap-14" aria-hidden={false}>
        {loop.map((item, index) => {
          const isCopy = index >= items.length;
          return (
            <div
              key={`${item.participationId}-${isCopy ? "copy" : "src"}-${index}`}
              className="flex shrink-0 items-center justify-center px-3 sm:px-5"
              data-loop-copy={isCopy ? "1" : "0"}
            >
              <MarqueeLogoCell item={item} />
            </div>
          );
        })}
      </div>
      <ul className="sr-only">
        {items.map((item) => (
          <li key={`sr-${item.participationId}`}>{item.partnerName}</li>
        ))}
      </ul>
    </div>
  );
}
