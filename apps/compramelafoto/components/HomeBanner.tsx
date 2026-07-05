"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type BannerSlide = { src: string; alt: string; link?: string; openInNewTab?: boolean };

const DEFAULT_BANNER_IMAGES: BannerSlide[] = [
  { src: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1600&q=80", alt: "Fotógrafo en sesión" },
  { src: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1600&q=80", alt: "Cámara y fotógrafo" },
  { src: "https://images.unsplash.com/photo-1556656793-08538906a9f8?w=1600&q=80", alt: "Persona mirando el celular, entrando a ComprameLaFoto" },
  { src: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1600&q=80", alt: "Fotógrafo trabajando" },
];

export default function HomeBanner() {
  const [bannerIndex, setBannerIndex] = useState(0);
  const [bannerEnabled, setBannerEnabled] = useState(true);
  const [bannerImages, setBannerImages] = useState<BannerSlide[]>([]);

  useEffect(() => {
    let mounted = true;
    fetch("/api/banner")
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        const enabled = data.enabled !== false;
        setBannerEnabled(enabled);
        if (!enabled) {
          setBannerImages([]);
        } else if (Array.isArray(data.images) && data.images.length > 0) {
          setBannerImages(data.images);
        } else {
          setBannerImages(DEFAULT_BANNER_IMAGES);
        }
      })
      .catch(() => {
        if (mounted) {
          setBannerEnabled(true);
          setBannerImages(DEFAULT_BANNER_IMAGES);
        }
      });
    return () => { mounted = false; };
  }, []);

  const slideImages = bannerImages.length > 0 ? bannerImages : DEFAULT_BANNER_IMAGES;

  useEffect(() => {
    if (slideImages.length === 0) return;
    const t = setInterval(() => {
      setBannerIndex((i) => (i + 1) % slideImages.length);
    }, 5000);
    return () => clearInterval(t);
  }, [slideImages.length]);

  if (!bannerEnabled || slideImages.length === 0) return null;

  return (
    <section className="w-full overflow-hidden bg-black" aria-label="Galería">
      <div className="relative w-full" style={{ aspectRatio: "21/4" }}>
        <div
          className="flex h-full transition-transform duration-700 ease-in-out"
          style={{ width: `${slideImages.length * 100}%`, transform: `translateX(-${bannerIndex * (100 / slideImages.length)}%)` }}
        >
          {slideImages.map((img, i) => {
            const content = (
              <>
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  className="object-cover"
                  sizes="100vw"
                  priority={i === 0}
                  unoptimized={img.src.startsWith("http")}
                />
                <div className="absolute inset-0 bg-black/20" />
              </>
            );
            const wrapperClass = "relative flex-1 min-w-0 h-full block";
            if (img.link?.trim()) {
              return (
                <a
                  key={i}
                  href={img.link.trim()}
                  target={img.openInNewTab ? "_blank" : "_self"}
                  rel={img.openInNewTab ? "noopener noreferrer" : undefined}
                  className={wrapperClass}
                >
                  {content}
                </a>
              );
            }
            return (
              <div key={i} className={wrapperClass}>
                {content}
              </div>
            );
          })}
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {slideImages.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ver imagen ${i + 1}`}
              onClick={() => setBannerIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${bannerIndex === i ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/70"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
