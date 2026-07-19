import Image from "next/image";
import { cn } from "@/lib/cn";

type MagazineImageProps = {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  imageClassName?: string;
  aspect?: "square" | "portrait" | "landscape" | "hero" | "auto";
};

const aspectClass = {
  square: "aspect-square",
  portrait: "aspect-[3/4]",
  landscape: "aspect-[16/9]",
  hero: "aspect-[4/5] sm:aspect-[16/10] lg:aspect-[21/9]",
  auto: "",
} as const;

export function MagazineImage({
  src,
  alt,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
  className,
  imageClassName,
  aspect = "landscape",
}: MagazineImageProps) {
  return (
    <figure
      className={cn(
        "relative overflow-hidden bg-ck-surface-strong",
        aspectClass[aspect],
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={cn("object-cover object-center", imageClassName)}
      />
    </figure>
  );
}
