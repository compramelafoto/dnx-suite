"use client";

import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="fr-section border-t border-[#1a1a1a]">
      <div className="fr-container-wide mx-auto flex w-full flex-col items-center gap-12">
        <Link href="/" className="flex items-center justify-center" aria-label="FotoRank">
          <Image
            src="/fotorank-isologo.png"
            alt="FotoRank"
            width={48}
            height={48}
            className="h-12 w-12 md:h-14 md:w-14 object-contain"
          />
        </Link>

        <div className="w-full border-t border-[#1a1a1a] pt-10">
          <p className="text-center fr-caption">
            © {new Date().getFullYear()} FotoRank. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
