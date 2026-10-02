"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import {
  ETIQUETA_PLATAFORMA,
  portfolioVideoEmbedUrl,
  portfolioVideoThumbnail,
} from "@/lib/portfolio/videos";
import type { PublicPortfolioVideo } from "@/lib/portfolio/public-queries";

/**
 * Los videos de una ficha.
 *
 * ── Por qué el reproductor no carga solo ──
 *
 * Cada iframe de YouTube trae más de un mega de scripts. Doce cargando a la vez volverían la página
 * inusable en un teléfono, justo donde más se la va a abrir. Así que primero se ve una tarjeta y el
 * reproductor aparece **al tocar**: para el visitante es un clic, y para quien sólo pasa de largo
 * es un mega en vez de doce.
 *
 * ── Cada plataforma como puede ──
 *
 * YouTube y Vimeo van en iframe —es la lista blanca que ya rige en el repo—. Instagram y TikTok,
 * con el script de su proveedor. Cualquier otra dirección queda como tarjeta con enlace: no se
 * puede embeber una dirección arbitraria en el sitio de la institución, pero el socio igual puede
 * mostrar su demo reel.
 */
export function PortfolioVideos({
  videos,
  authorName,
}: {
  videos: PublicPortfolioVideo[];
  authorName: string;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);

  const hayEmbebidoSocial = videos.some(
    (v) => v.platform === "INSTAGRAM" || v.platform === "TIKTOK",
  );

  useEffect(() => {
    const w = window as unknown as { instgrm?: { Embeds?: { process?: () => void } } };
    w.instgrm?.Embeds?.process?.();
  }, [videos]);

  if (videos.length === 0) return null;

  return (
    <section className="space-y-5" aria-labelledby="fo-videos-titulo">
      <h2 id="fo-videos-titulo" className="text-xl font-semibold tracking-tight">
        Videos
      </h2>

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => {
          const embed = portfolioVideoEmbedUrl(video);
          const miniatura = portfolioVideoThumbnail(video);
          const estaAbierto = abierto === video.id;

          // ── Instagram y TikTok: el script del proveedor dibuja lo suyo ──
          if (video.platform === "INSTAGRAM" || video.platform === "TIKTOK") {
            return (
              <li key={video.id} className="overflow-hidden rounded-lg">
                <blockquote
                  className={video.platform === "INSTAGRAM" ? "instagram-media" : "tiktok-embed"}
                  data-instgrm-permalink={video.platform === "INSTAGRAM" ? video.url : undefined}
                  data-instgrm-version={video.platform === "INSTAGRAM" ? "14" : undefined}
                  cite={video.platform === "TIKTOK" ? video.url : undefined}
                  style={{ background: "#FFF", margin: 0, minWidth: "unset", width: "100%" }}
                >
                  {/* Si el script no carga —bloqueador, video borrado— queda un enlace que anda. */}
                  <a href={video.url} target="_blank" rel="noopener noreferrer" className="block p-4 text-sm">
                    Ver en {ETIQUETA_PLATAFORMA[video.platform]}
                  </a>
                </blockquote>
              </li>
            );
          }

          // ── Cualquier otra red: tarjeta con enlace ──
          if (!embed) {
            return (
              <li key={video.id}>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border text-sm transition-opacity hover:opacity-75"
                  style={{ borderColor: "color-mix(in srgb, var(--wsite-text) 25%, transparent)" }}
                >
                  <ExternalLink size={20} aria-hidden />
                  <span>{video.title ?? "Ver el video"}</span>
                  <span className="text-xs opacity-60">{new URL(video.url).hostname}</span>
                </a>
              </li>
            );
          }

          // ── YouTube y Vimeo: tarjeta que se convierte en reproductor al tocar ──
          return (
            <li key={video.id} className="space-y-2">
              <div
                className="relative aspect-video w-full overflow-hidden rounded-lg"
                style={{ backgroundColor: "color-mix(in srgb, var(--wsite-text) 10%, transparent)" }}
              >
                {estaAbierto ? (
                  <iframe
                    src={embed}
                    title={video.title ?? `Video de ${authorName}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full border-0"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setAbierto(video.id)}
                    aria-label={`Reproducir ${video.title ?? `video de ${authorName}`}`}
                    className="group absolute inset-0 h-full w-full"
                  >
                    {miniatura ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={miniatura}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : null}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-black shadow-lg transition-transform duration-300 group-hover:scale-110">
                        <Play size={22} className="ml-1" aria-hidden />
                      </span>
                    </span>
                    <span className="absolute bottom-2 right-2 rounded bg-black/65 px-2 py-0.5 text-[11px] text-white/90">
                      {ETIQUETA_PLATAFORMA[video.platform]}
                    </span>
                  </button>
                )}
              </div>

              {video.title ? <p className="text-sm opacity-80">{video.title}</p> : null}
            </li>
          );
        })}
      </ul>

      {hayEmbebidoSocial ? (
        <>
          <Script src="https://www.instagram.com/embed.js" strategy="lazyOnload" />
          <Script src="https://www.tiktok.com/embed.js" strategy="lazyOnload" />
        </>
      ) : null}
    </section>
  );
}
