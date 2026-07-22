import Image from "next/image";
import { cn } from "@/lib/cn";
import { formarParteContent } from "@/content/formar-parte";

const logos = formarParteContent.allies.logos;

/** Alturas generosas: los wordmarks no deben verse “perdidos” en el banner. */
const scaleClass = {
  md: "h-16 max-w-[14rem] sm:h-[4.5rem] sm:max-w-[16rem]",
  lg: "h-[4.5rem] max-w-[16rem] sm:h-20 sm:max-w-[19rem]",
  xl: "h-20 max-w-[18rem] sm:h-24 sm:max-w-[22rem]",
} as const;

function LogoMark({
  src,
  scale,
}: {
  src: string;
  scale: keyof typeof scaleClass;
}) {
  const className = cn(
    "w-auto object-contain opacity-95 transition-opacity duration-[var(--ck-duration-base)] group-hover:opacity-100",
    scaleClass[scale],
  );

  if (src.endsWith(".svg")) {
    return (
      // SVG wordmarks locales: <img> evita restricciones de next/image.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={className} />
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={360}
      height={120}
      className={className}
    />
  );
}

/** Banner deslizante de logos a color. */
export function AlliesLogoMarquee() {
  const loop = [...logos, ...logos];

  return (
    <div className="ck-marquee border-y border-ck-border bg-ck-surface-base/40 py-16 sm:py-20">
      <div className="ck-marquee__track" aria-hidden>
        {loop.map((logo, index) => {
          const scale = "scale" in logo && logo.scale ? logo.scale : "lg";

          return (
            <div
              key={`${logo.name}-${index}`}
              className="group flex w-[18rem] shrink-0 items-center justify-center px-6 sm:w-[22rem] sm:px-8"
            >
              <LogoMark src={logo.src} scale={scale} />
            </div>
          );
        })}
      </div>

      <ul className="sr-only">
        {logos.map((logo) => (
          <li key={logo.name}>{logo.name}</li>
        ))}
      </ul>
    </div>
  );
}
