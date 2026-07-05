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

export default function PhotographerHeader({ photographer, hideLogo }: PhotographerHeaderProps) {
  if (hideLogo) return null;
  
  const bgColor = photographer.headerBackgroundColor ?? photographer.secondaryColor ?? "#2d2d2d";
  
  return (
    <header
      className="text-white sticky top-0 z-40 shadow-sm"
      style={{ backgroundColor: bgColor }}
    >
      <div className="container-custom py-4 md:py-5">
        <div className="flex items-center justify-center">
          {photographer.logoUrl ? (
            <Image
              src={photographer.logoUrl}
              alt={photographer.name || "Logo"}
              width={440}
              height={144}
              className="h-20 md:h-24 w-auto object-contain"
              priority
              unoptimized={photographer.logoUrl.startsWith("/uploads/")}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
