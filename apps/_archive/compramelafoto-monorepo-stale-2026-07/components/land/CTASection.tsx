"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";

export default function CTASection() {
  return (
    <section className="section-spacing bg-[#f7f5f2] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(194,123,61,0.08),transparent_60%)]" />
      <div className="relative container-custom max-w-4xl mx-auto text-center">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4 md:text-3xl">
          Empezá a vender tus fotos de forma más simple.
        </h2>
        <p className="text-[#6b7280] mb-8">
          Crear tu cuenta lleva menos de un minuto.
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
