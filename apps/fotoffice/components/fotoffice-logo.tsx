import Image from "next/image";

/** Asset oficial PNG con transparencia: `public/fotoffice.png`. */
const LOGO_SRC = "/fotoffice.png";
const LOGO_WIDTH = 1536;
const LOGO_HEIGHT = 1024;

export type FotofficeLogoVariant = "hero" | "compact" | "sidebar";

export function FotofficeLogo({
  variant = "compact",
  className = "",
  priority = false,
}: {
  variant?: FotofficeLogoVariant;
  className?: string;
  priority?: boolean;
}) {
  const size =
    variant === "hero"
      ? "h-[4.5rem] md:h-[5.5rem] w-auto max-w-[min(100%,22rem)]"
      : variant === "sidebar"
        ? "h-24 md:h-[6.75rem] w-auto max-w-full"
        : "h-12 md:h-14 w-auto max-w-[min(100%,20rem)]";

  const align =
    variant === "sidebar" ? "object-left" : "object-center mx-auto";

  return (
    <Image
      src={LOGO_SRC}
      alt="FotOffice"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      className={`object-contain ${align} ${size} ${className}`.trim()}
      sizes={
        variant === "sidebar"
          ? "(max-width: 768px) 100vw, 280px"
          : variant === "hero"
            ? "(max-width: 768px) 280px, 352px"
            : "(max-width: 768px) 240px, 280px"
      }
    />
  );
}
