"use client";

import Image from "next/image";
import { motion } from "framer-motion";

// Imágenes 3:2 sin rostros humanos: paisajes, animales, urbana, naturaleza, conceptual
const PHOTOS = [
  { src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop&q=80", alt: "Montaña" },
  { src: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600&h=400&fit=crop&q=80", alt: "Animal" },
  { src: "https://images.unsplash.com/photo-1494548162494-384bba4ab999?w=600&h=400&fit=crop&q=80", alt: "Amanecer" },
  { src: "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=400&fit=crop&q=80", alt: "Fotografía urbana" },
  { src: "https://images.unsplash.com/photo-1493863641943-9b68992a8d07?w=600&h=400&fit=crop&q=80", alt: "Paisaje" },
  { src: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=600&h=400&fit=crop&q=80", alt: "León" },
  { src: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&h=400&fit=crop&q=80", alt: "Paisaje rural" },
  { src: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&h=400&fit=crop&q=80", alt: "Cámara" },
  { src: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&h=400&fit=crop&q=80", alt: "Naturaleza" },
  { src: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600&h=400&fit=crop&q=80", alt: "Animal" },
  { src: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&h=400&fit=crop&q=80", alt: "Paisaje montañoso" },
  { src: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=600&h=400&fit=crop&q=80", alt: "Street photography" },
  { src: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600&h=400&fit=crop&q=80", alt: "Flores" },
  { src: "https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=600&h=400&fit=crop&q=80", alt: "Naturaleza" },
  { src: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&h=400&fit=crop&q=80", alt: "Paisaje otoñal" },
  { src: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&h=400&fit=crop&q=80", alt: "Fotografía artística" },
  { src: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&h=400&fit=crop&q=80", alt: "Naturaleza" },
  { src: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&h=400&fit=crop&q=80", alt: "Arquitectura" },
  { src: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600&h=400&fit=crop&q=80", alt: "Fotografía de viaje" },
  { src: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop&q=80", alt: "Paisaje" },
  { src: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&h=400&fit=crop&q=80", alt: "Bosque" },
  { src: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=600&h=400&fit=crop&q=80", alt: "Paisaje" },
  { src: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&h=400&fit=crop&q=80", alt: "Paisaje montañoso" },
  { src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop&q=80", alt: "Montaña" },
  { src: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&h=400&fit=crop&q=80", alt: "Paisaje rural" },
  { src: "https://images.unsplash.com/photo-1549366021-9f761d450615?w=600&h=400&fit=crop&q=80", alt: "Ciervo" },
];

export function PhotoBanner() {
  return (
    <div className="relative h-[8rem] w-full overflow-hidden border-b border-[#1a1a1a] md:h-[10rem] lg:h-[12rem]">
      <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/60 via-transparent to-[#050505]/60 z-10 pointer-events-none" />
      <motion.div
        className="absolute inset-0 flex items-center gap-2"
        animate={{ x: [0, -6000] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: 180,
            ease: "linear",
          },
        }}
      >
        {[...PHOTOS, ...PHOTOS].map((photo, i) => (
          <div
            key={i}
            className="relative aspect-[3/2] h-full w-auto shrink-0"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              className="object-contain grayscale"
              sizes="(max-width: 768px) 10rem, (max-width: 1024px) 13rem, 16rem"
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
