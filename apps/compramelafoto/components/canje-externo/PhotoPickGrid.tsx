"use client";

/**
 * Grilla para elegir fotos. Tocar la foto la elige o la saca; la lupa la abre grande.
 * `badge` marca fotos con otro estado (p. ej. "En tu combo" en el paso de extras).
 */

type Props = {
  photoIds: number[];
  selected: number[];
  onToggle: (photoId: number) => void;
  onZoom: (photoId: number) => void;
  thumbUrl: (photoId: number) => string;
  /** Si ya no se puede elegir más, las no elegidas se atenúan. */
  full?: boolean;
  badge?: (photoId: number) => string | null;
  accent?: "combo" | "extra";
};

export default function PhotoPickGrid({
  photoIds,
  selected,
  onToggle,
  onZoom,
  thumbUrl,
  full = false,
  badge,
  accent = "combo",
}: Props) {
  const ring = accent === "combo" ? "ring-[#2f7d5b]" : "ring-[#c27b3d]";
  const chip = accent === "combo" ? "bg-[#2f7d5b]" : "bg-[#c27b3d]";
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 md:grid-cols-4 sm:gap-3">
      {photoIds.map((id) => {
        const pos = selected.indexOf(id);
        const isSel = pos >= 0;
        const dim = full && !isSel;
        const tag = badge?.(id) ?? null;
        return (
          <li key={id} className="relative">
            <button
              type="button"
              onClick={() => onToggle(id)}
              aria-pressed={isSel}
              aria-label={isSel ? `Sacar foto ${id}` : `Elegir foto ${id}`}
              className={`block w-full overflow-hidden rounded-lg bg-[#efe9e2] transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d] ${
                isSel ? `ring-4 ${ring}` : "ring-1 ring-black/5"
              } ${dim ? "opacity-45" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl(id)} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
            </button>
            {isSel ? (
              <span
                className={`pointer-events-none absolute left-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm font-semibold text-white shadow ${chip}`}
              >
                {accent === "combo" ? pos + 1 : "✓"}
              </span>
            ) : null}
            {tag ? (
              <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-medium text-[#2f7d5b] shadow-sm">
                {tag}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onZoom(id)}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#3d4148] shadow ring-1 ring-black/10 focus-visible:outline-2 focus-visible:outline-[#c27b3d]"
              aria-label="Ver la foto en grande"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
