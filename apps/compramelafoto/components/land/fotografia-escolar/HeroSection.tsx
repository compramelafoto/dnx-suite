"use client";

import Link from "next/link";
import Image from "next/image";
import Button from "@/components/ui/Button";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#f7f5f2] w-full">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(194,123,61,0.15),transparent_55%)]" />
      <div className="relative w-full max-w-7xl mx-auto py-16 sm:py-20 md:py-28 lg:py-32 px-4 sm:px-8 md:px-12 lg:px-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold leading-tight text-[#111827] sm:text-3xl md:text-4xl lg:text-5xl tracking-tight">
              La plataforma creada para fotógrafos que trabajan con colegios.
            </h1>
            <p className="mt-6 sm:mt-8 text-base text-[#6b7280] md:text-lg lg:text-xl leading-relaxed">
              Organizá la venta de fotos escolares, automatizá la selección de imágenes y ofrecé a las familias una experiencia moderna, segura y ordenada.
            </p>
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/registro" className="inline-flex justify-center sm:inline">
                <Button
                  variant="primary"
                  className="w-full sm:w-auto text-base px-8 py-4 min-h-[52px] sm:min-h-0 text-lg"
                >
                  Crear cuenta gratis
                </Button>
              </Link>
              <a href="#como-funciona" className="inline-flex justify-center sm:inline">
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto text-base px-8 py-4 min-h-[52px] sm:min-h-0 border-black/10"
                >
                  Ver cómo funciona
                </Button>
              </a>
            </div>
          </div>
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-black/6 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.15)] bg-white">
            <Image
              src="https://images.unsplash.com/photo-1510531704581-5b2870972060?w=800&q=80"
              alt="Aula escolar - Fotografía escolar"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
