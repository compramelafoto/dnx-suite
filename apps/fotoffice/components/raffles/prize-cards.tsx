import Image from "next/image";
import type { ReactNode } from "react";
import type { PortalPrize } from "@/lib/raffles/portal";

/**
 * Los premios de un sorteo como fichas: el logo de quien lo dona arriba y centrado, el premio
 * grande abajo. Es lo que el socio mira para decidir si le importa estar al día, así que el
 * premio manda y la marca se ve entera.
 *
 * Tocar la ficha abre el Instagram del aliado (o su sitio, si no tiene). Es el agradecimiento
 * concreto a quien dona: llevarle gente. Los datos salen de DNX Partners.
 *
 * `compacta` es la versión del inicio del portal: misma ficha, más chica. El logo ocupa toda la
 * franja blanca en las dos versiones: muchos logos traen aire propio alrededor y, si además se
 * los encierra en una caja chica, quedan diminutos.
 */
export function PrizeCards({ prizes, compacta = false }: { prizes: PortalPrize[]; compacta?: boolean }) {
  return (
    <ul className={`grid gap-4 ${compacta ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
      {prizes.map((p) => (
        <li key={p.id}>
          <Ficha href={p.partnerInstagramUrl ?? p.partnerWebsiteUrl}>
            <div
              className={`relative flex items-center justify-center border-b border-[var(--fo-border)] bg-white ${
                compacta ? "h-36 p-3 sm:h-40" : "h-52 p-4"
              }`}
            >
              {p.partnerLogoUrl ? (
                <LogoAliado src={p.partnerLogoUrl} alt={p.partnerName ?? ""} compacta={compacta} />
              ) : (
                <span className="text-sm font-semibold text-[var(--fo-muted)]">
                  {p.partnerName ?? "Premio"}
                </span>
              )}
            </div>
            <div className={`flex flex-1 flex-col items-center text-center ${compacta ? "gap-1 p-3" : "gap-2 p-5"}`}>
              <p
                className={`font-semibold leading-snug text-[var(--fo-text)] ${
                  compacta ? "text-sm" : "text-xl"
                }`}
              >
                {p.title}
              </p>
              {p.partnerName ? (
                <p className="text-xs text-[var(--fo-muted)]">
                  Lo dona <span className="font-medium text-[var(--fo-text-secondary)]">{p.partnerName}</span>
                </p>
              ) : null}
              {!compacta && p.description ? (
                <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{p.description}</p>
              ) : null}
              {p.winnerLabel ? (
                <p className="text-xs font-medium text-[var(--fo-success)]">Ganó: {p.winnerLabel}</p>
              ) : null}
            </div>
            {!compacta && (p.partnerInstagramUrl || p.partnerWebsiteUrl) ? (
              <p className="flex items-center justify-center gap-2 border-t border-[var(--fo-border)] px-5 py-3 text-sm font-medium text-[var(--fo-accent-hover)]">
                {p.partnerInstagramUrl ? (
                  <>
                    <IconoInstagram />
                    Ver en Instagram
                  </>
                ) : (
                  "Visitar su sitio"
                )}
              </p>
            ) : null}
          </Ficha>
        </li>
      ))}
    </ul>
  );
}

function Ficha({ href, children }: { href: string | null; children: ReactNode }) {
  const clase =
    "flex h-full flex-col overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] shadow-[var(--fo-shadow-sm)]";
  if (!href) return <div className={clase}>{children}</div>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${clase} transition hover:-translate-y-0.5 hover:border-[var(--fo-accent)] hover:shadow-[var(--fo-shadow-md)]`}
    >
      {children}
    </a>
  );
}

/**
 * Los logos de DNX Partners llegan por una ruta propia y pesan lo que subió el aliado (más de un
 * mega, a veces). Esos pasan por el optimizador de imágenes; los que son una dirección completa
 * —las instantáneas viejas— se muestran tal cual.
 */
function LogoAliado({ src, alt, compacta }: { src: string; alt: string; compacta: boolean }) {
  const caja = "h-full w-full";
  if (src.startsWith("/")) {
    return (
      <span className={`relative block ${caja}`}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={compacta ? "(max-width: 640px) 45vw, 360px" : "(max-width: 640px) 90vw, 420px"}
          className="object-contain"
        />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- dirección externa guardada en el premio
    <img src={src} alt={alt} className={`${caja} object-contain`} />
  );
}

function IconoInstagram() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
