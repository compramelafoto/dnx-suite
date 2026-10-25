"use client";

import { useState } from "react";
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

/** Un logo más alto que ancho necesita más alto para que se lea el nombre que suele llevar abajo. */
const VERTICAL_LOGO_RATIO = 1.1;

export default function PhotographerHeader({ photographer, hideLogo }: PhotographerHeaderProps) {
  const [isVerticalLogo, setIsVerticalLogo] = useState(false);

  if (hideLogo) return null;

  const bgColor = photographer.headerBackgroundColor ?? photographer.secondaryColor ?? "#2d2d2d";

  return (
    <header
      // Con logo vertical el encabezado es alto: si quedara fijo taparía media pantalla en el celular.
      className={`text-white z-40 shadow-sm ${isVerticalLogo ? "relative" : "sticky top-0"}`}
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
              className={`${isVerticalLogo ? "h-44 md:h-56" : "h-20 md:h-24"} w-auto object-contain`}
              priority
              unoptimized={photographer.logoUrl.startsWith("/uploads/")}
              onLoad={(event) => {
                const img = event.currentTarget;
                if (img.naturalWidth > 0 && img.naturalHeight > img.naturalWidth * VERTICAL_LOGO_RATIO) {
                  setIsVerticalLogo(true);
                }
              }}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
