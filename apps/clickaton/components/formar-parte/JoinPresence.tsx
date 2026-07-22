import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { cn } from "@/lib/cn";
import { formarParteContent } from "@/content/formar-parte";

const { presence } = formarParteContent;

const sizeClass = {
  hero: "sm:col-span-2 lg:col-span-3 aspect-[16/9] min-h-[16rem]",
  wide: "sm:col-span-2 aspect-[16/10] min-h-[15rem]",
  /** Roll-up alto: acompaña dos celdas (remeras + credenciales). */
  portrait: "aspect-[3/4] min-h-[18rem] lg:row-span-2 lg:min-h-0 lg:aspect-auto lg:h-full",
  /** Par lado a lado (remeras / credenciales): llena huecos sin letterbox. */
  pair: "aspect-[3/4] min-h-[18rem]",
  square: "aspect-square min-h-[14rem]",
} as const;

/** Fotos de escena: cover. Productos aislados: contain. */
const coverSizes = new Set(["hero", "portrait", "pair"]);

export function JoinPresence() {
  return (
    <Section
      tone="raised"
      className="py-20 sm:py-28 lg:py-36"
      aria-labelledby="join-presence-title"
    >
      <Container width="wide">
        <div className="max-w-3xl">
          <p className="ck-overline text-ck-yellow">{presence.eyebrow}</p>
          <h2 id="join-presence-title" className="ck-display-lg mt-6 text-ck-text">
            {presence.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{presence.lead}</p>
        </div>

        <ul className="mt-14 grid grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3 lg:auto-rows-[minmax(14rem,auto)] lg:gap-5">
          {presence.collage.map((item) => {
            const useCover = coverSizes.has(item.size);

            return (
              <li
                key={item.id}
                tabIndex={0}
                className={cn(
                  "group relative overflow-hidden border border-ck-border bg-[#0a0a0a] outline-none focus-visible:ring-2 focus-visible:ring-ck-yellow/70",
                  sizeClass[item.size],
                )}
              >
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  sizes={
                    item.size === "hero"
                      ? "100vw"
                      : item.size === "wide"
                        ? "(max-width: 1024px) 100vw, 66vw"
                        : "(max-width: 640px) 100vw, 33vw"
                  }
                  className={cn(
                    "transition-[transform,opacity] duration-[var(--ck-duration-slow)] ease-[var(--ck-easing-standard)] group-hover:scale-[1.02]",
                    useCover
                      ? "object-cover object-center"
                      : "object-contain object-center p-3 sm:p-4",
                  )}
                />

                <div
                  className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/85 via-black/35 to-transparent opacity-0 transition-opacity duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)] group-hover:opacity-100 group-focus-within:opacity-100"
                  aria-hidden
                >
                  <div className="w-full p-5 sm:p-6">
                    <p
                      className="text-xl uppercase tracking-wide text-ck-yellow sm:text-2xl"
                      style={{ fontFamily: "var(--ck-font-display)" }}
                    >
                      {item.label}
                    </p>
                    <p className="ck-body-sm mt-2 max-w-md text-ck-text">{item.description}</p>
                  </div>
                </div>

                <span className="sr-only">
                  {item.label}. {item.description}
                </span>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
