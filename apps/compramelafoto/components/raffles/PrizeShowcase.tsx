import { Gift, Trophy } from "lucide-react";

/** La tarjeta de un premio, para la página pública y el panel: foto, quién lo da y, si salió, el ganador. */
export default function PrizeShowcase({
  order,
  title,
  description,
  imageUrl,
  sponsorName,
  sponsorLogoUrl,
  sponsorUrl,
  estimatedValueArs,
  winner,
}: {
  order: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  sponsorName?: string | null;
  sponsorLogoUrl?: string | null;
  sponsorUrl?: string | null;
  estimatedValueArs?: number | null;
  winner?: string | null;
}) {
  const sponsor = sponsorLogoUrl || sponsorName ? (
    <span className="inline-flex items-center gap-2">
      {sponsorLogoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- logos subidos a R2
        <img src={sponsorLogoUrl} alt="" className="h-6 w-auto max-w-[6rem] object-contain" />
      )}
      {sponsorName && <span>{sponsorName}</span>}
    </span>
  ) : null;

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-[#111827]/10 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-[#fdf3ea] via-[#f7e3cf] to-[#eec9a4]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- fotos subidas a R2
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Gift className="h-16 w-16 text-[#c27b3d]/70" strokeWidth={1.5} />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-[#c27b3d] shadow-sm">
          Premio {order}
        </span>
        {winner && (
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/75 via-black/50 to-transparent px-4 pb-3 pt-8 text-white">
            <Trophy className="h-4 w-4 shrink-0 text-amber-300" />
            <p className="text-sm font-semibold">Ganó {winner}</p>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="text-lg font-bold leading-snug text-[#111827]">{title}</h3>
        {description && <p className="text-sm text-[#4b5563]">{description}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-[#6b7280]">
          {sponsor ? (
            sponsorUrl ? (
              <a href={sponsorUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#111827]">
                {sponsor}
              </a>
            ) : (
              sponsor
            )
          ) : (
            <span />
          )}
          {estimatedValueArs ? <span>Valor estimado ${estimatedValueArs.toLocaleString("es-AR")}</span> : null}
        </div>
      </div>
    </article>
  );
}
