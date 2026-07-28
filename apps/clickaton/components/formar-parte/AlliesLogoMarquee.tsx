import Image from "next/image";
import { cn } from "@/lib/cn";
import { formarParteContent } from "@/content/formar-parte";

const logos = formarParteContent.allies.logos;

const scaleClass = {
  md: "h-12 max-w-[11rem] sm:h-14 sm:max-w-[13rem]",
  lg: "h-14 max-w-[13rem] sm:h-16 sm:max-w-[15rem]",
  xl: "h-16 max-w-[15rem] sm:h-[4.5rem] sm:max-w-[17rem]",
} as const;

function LogoMark({
  src,
  scale,
}: {
  src: string;
  scale: keyof typeof scaleClass;
}) {
  const className = cn(
    "ck-logo-bw w-auto object-contain",
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
      width={320}
      height={110}
      className={className}
    />
  );
}

/** Banner deslizante de logos en B/N (estilo original). */
export function AlliesLogoMarquee() {
  const loop = [...logos, ...logos];

  return (
    <div className="ck-marquee border-y border-ck-border bg-ck-surface-base/40 py-12 sm:py-14">
      <div className="ck-marquee__track" aria-hidden>
        {loop.map((logo, index) => {
          const scale = "scale" in logo && logo.scale ? logo.scale : "lg";

          return (
            <div
              key={`${logo.name}-${index}`}
              className="group flex w-[14rem] shrink-0 items-center justify-center px-5 sm:w-[16rem] sm:px-6"
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
