import type { PartnersBlockConfig } from "@/lib/website/blocks";
import { externalHttpUrl, isShowableImageUrl } from "@/lib/website/blocks-extra";
import { levelStyle } from "@/lib/website/typography";

/** Logos de colaboradores (sponsors, marcas, instituciones). Cada uno puede llevar a su sitio en
 * otra pestaña; el enlace se vuelve a validar acá aunque el schema ya lo filtre. En escala de
 * grises opcional (vuelven a color al pasar el mouse). Sin logos, en el sitio no se dibuja. */
export function PartnersBlockView({ config, data }: { config: PartnersBlockConfig; blockId?: string; data?: unknown }) {
  const items = config.items.filter((i) => isShowableImageUrl(i.imageUrl));
  if (items.length === 0) {
    if (data !== undefined) return null;
    return (
      <section className="px-6 py-12">
        <p className="mx-auto max-w-3xl rounded-2xl border border-dashed p-8 text-center opacity-60" style={levelStyle("body", { color: true })}>
          Agregá los logos de tus colaboradores.
        </p>
      </section>
    );
  }
  const gray = config.grayscale ? "grayscale opacity-80 transition hover:grayscale-0 hover:opacity-100" : "";

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        {config.title.trim() ? (
          <h2 className="text-center" style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>
            {config.title}
          </h2>
        ) : null}
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-8">
          {items.map((item, i) => {
            const name = item.name.trim();
            const logo = (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt={name || "Logo de colaborador"} loading="lazy" className={`h-16 w-auto max-w-[10rem] object-contain ${gray}`} />
            );
            const href = externalHttpUrl(item.url);
            return (
              <li key={item.id || i}>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" title={name || undefined}>
                    {logo}
                  </a>
                ) : (
                  logo
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
