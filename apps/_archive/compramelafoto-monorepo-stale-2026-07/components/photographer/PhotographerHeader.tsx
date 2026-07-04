import Image from "next/image";

type Photographer = {
  id: number;
  name: string | null;
  logoUrl: string | null;
  secondaryColor: string | null;
  headerBackgroundColor?: string | null;
};

type PhotographerHeaderProps = {
  photographer: Photographer;
  handler: string;
  hideLogo?: boolean;
};

/** Fondo claro por defecto para que el logo (suele ser oscuro o full color) se lea bien. */
const DEFAULT_HEADER_BG = "#ffffff";

export default function PhotographerHeader({ photographer, hideLogo }: PhotographerHeaderProps) {
  if (hideLogo) return null;

  const bgColor = photographer.headerBackgroundColor ?? DEFAULT_HEADER_BG;

  return (
    <header
      className="sticky top-0 z-40 border-b border-[#e8e6e3] shadow-[0_1px_0_rgba(0,0,0,0.04)]"
      style={{ backgroundColor: bgColor }}
    >
      <div className="container-custom py-4 md:py-6">
        <div className="flex items-center justify-center">
          {photographer.logoUrl ? (
            <Image
              src={photographer.logoUrl}
              alt={photographer.name || "Logo"}
              width={440}
              height={144}
              className="h-[4.5rem] md:h-28 w-auto max-w-[min(100%,20rem)] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              priority
              unoptimized={photographer.logoUrl.startsWith("/uploads/")}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
