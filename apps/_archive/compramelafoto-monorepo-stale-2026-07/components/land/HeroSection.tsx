"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#f7f5f2] w-full">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(194,123,61,0.15),transparent_55%)]" />
      <div className="relative w-full max-w-6xl mx-auto py-16 sm:py-20 md:py-28 lg:py-32 px-4 sm:px-8 md:px-12 lg:px-16">
        <div className="w-full text-center">
          <h1 className="text-2xl font-bold leading-tight text-[#111827] sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl tracking-tight">
            La forma más simple de vender tus fotos online.
          </h1>
          <p className="mt-6 sm:mt-8 text-base text-[#6b7280] md:text-lg lg:text-xl leading-relaxed">
            Publicá tus fotos, compartí tu galería y dejá que tus clientes compren y paguen solos.
            Sin desorden. Sin perseguir mensajes. Sin procesos manuales.
          </p>
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-4 justify-center">
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
      </div>
    </section>
  );
}
