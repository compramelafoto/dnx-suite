"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";

export default function CTASection() {
  return (
    <section className="section-spacing bg-[#f7f5f2] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(194,123,61,0.08),transparent_60%)]" />
      <div className="relative container-custom max-w-5xl mx-auto text-center">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4 md:text-3xl">
          Profesionalizá tu servicio de fotografía escolar.
        </h2>
        <p className="text-[#6b7280] mb-8 text-base md:text-lg">
          ComprameLaFoto te permite organizar tus galerías escolares, automatizar procesos y ofrecer una experiencia moderna y segura a las familias.
        </p>
        <Link href="/registro">
          <Button variant="primary" className="text-lg px-10 py-4">
            Crear cuenta gratis
          </Button>
        </Link>
      </div>
    </section>
  );
}
