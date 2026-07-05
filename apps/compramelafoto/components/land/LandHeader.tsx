"use client";

import Image from "next/image";
import Link from "next/link";
import Button from "@/components/ui/Button";

export default function LandHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/95 backdrop-blur-md">
      <div className="container-custom py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/watermark.png"
              alt="ComprameLaFoto"
              width={44}
              height={44}
              className="h-11 w-11 rounded-full ring-1 ring-black/10"
              priority
            />
            <span className="ml-3 text-sm font-medium text-[#1a1a1a] hidden sm:block">
              ComprameLaFoto
            </span>
          </Link>
          <Link href="/registro">
            <Button variant="primary" className="text-sm px-5 py-2.5">
              Crear cuenta gratis
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
