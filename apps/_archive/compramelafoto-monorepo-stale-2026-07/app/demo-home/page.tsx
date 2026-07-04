"use client";

/**
 * MOCKUP HOME - Para ver el ejemplo antes de impactar en la página principal.
 * Abrí http://localhost:3000/demo-home con npm run dev
 *
 * Incluye:
 * 1. Banner 16:9 extra wide con 3 fotos de fotógrafos (slide simple)
 * 2. Sección "¿Cómo funciona ComprameLaFoto?" en 3 pasos
 * 3. CTAs visibles: Ver galerías, Registrarme como fotógrafo, Registrarme como laboratorio
 * 4. Galerías más visibles (preview)
 */
import Link from "next/link";
import Image from "next/image";
import Button from "@/components/ui/Button";

const BANNER_IMAGES = [
  {
    src: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200&q=80",
    alt: "Fotógrafo en sesión",
  },
  {
    src: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1200&q=80",
    alt: "Cámara y fotógrafo",
  },
  {
    src: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1200&q=80",
    alt: "Fotógrafo trabajando",
  },
];

export default function DemoHomePage() {
  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      {/* Banner 16:9 - 3 fotos tipo slide (extra wide) */}
      <section className="w-full overflow-hidden bg-black">
        <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
          <div className="absolute inset-0 flex">
            {BANNER_IMAGES.map((img, i) => (
              <div key={i} className="relative flex-1 min-w-0">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  className="object-cover"
                  sizes="33vw"
                />
                <div className="absolute inset-0 bg-black/15" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hero corto + CTAs */}
      <section className="container-custom py-12 md:py-16">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-3xl md:text-4xl font-semibold text-[#111827]">
            Vendé fotos y cobrá con una experiencia moderna y confiable
          </h1>
          <p className="text-black/70">
            Conectamos fotógrafos y clientes: álbumes, selección, compra y entrega.
          </p>
        </div>
      </section>

      {/* Cómo funciona - 3 pasos + botones */}
      <section className="section-spacing bg-white">
        <div className="container-custom">
          <h2 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a] text-center mb-4">
            ¿Cómo funciona ComprameLaFoto?
          </h2>
          <p className="text-center text-[#6b7280] text-lg mb-12 max-w-2xl mx-auto">
            Tres pasos para empezar: subí o elegí fotos, configurá precios y vendé.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-14">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#c27b3d]/15 text-[#c27b3d] flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">
                Creá o entrá a una galería
              </h3>
              <p className="text-[#6b7280]">
                Los fotógrafos suben álbumes; los clientes entran por el link y ven sus fotos.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#c27b3d]/15 text-[#c27b3d] flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">
                Elegí y comprá
              </h3>
              <p className="text-[#6b7280]">
                Seleccioná las fotos que querés (digital o impresa). Pagás con Mercado Pago.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#c27b3d]/15 text-[#c27b3d] flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">
                Recibí todo listo
              </h3>
              <p className="text-[#6b7280]">
                Descarga digital o impresiones enviadas. Seguimiento claro en cada paso.
              </p>
            </div>
          </div>

          {/* CTAs principales */}
          <div className="flex flex-wrap gap-4 justify-center items-center">
            <Link href="/#albums" className="inline-flex">
              <Button variant="primary" className="text-base px-6 py-3">
                Ver galerías
              </Button>
            </Link>
            <Link href="/fotografo/registro" className="inline-flex">
              <Button variant="secondary" className="text-base px-6 py-3">
                Registrarme como fotógrafo
              </Button>
            </Link>
            <Link href="/lab/registro" className="inline-flex">
              <Button variant="secondary" className="text-base px-6 py-3">
                Registrarme como laboratorio
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Galerías más visibles - preview */}
      <section className="section-spacing bg-[#f9fafb]" id="albums">
        <div className="container-custom">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a]">
                Galerías disponibles
              </h2>
              <p className="text-[#6b7280] mt-1">
                Entrá a los álbumes de nuestros fotógrafos y encontrá tus fotos
              </p>
            </div>
            <Link href="/">
              <Button variant="primary" className="w-full sm:w-auto">
                Ver todas las galerías
              </Button>
            </Link>
          </div>
          <div className="rounded-xl border-2 border-dashed border-[#e5e7eb] bg-white/50 p-12 text-center">
            <p className="text-[#6b7280]">
              [En el home real acá iría la grilla de álbumes]
            </p>
            <p className="text-sm text-[#9ca3af] mt-2">
              Las galerías quedan más arriba y con botón destacado para mayor visibilidad
            </p>
          </div>
        </div>
      </section>

      {/* Aviso demo */}
      <div className="container-custom py-6 text-center">
        <p className="text-sm text-[#6b7280]">
          Esta es la vista de ejemplo. Si te gusta el orden y el diseño, lo pasamos al home real.
        </p>
        <Link href="/" className="text-sm text-[#c27b3d] hover:underline mt-2 inline-block">
          ← Volver al home actual
        </Link>
      </div>
    </div>
  );
}
