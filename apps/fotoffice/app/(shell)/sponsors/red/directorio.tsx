import Link from "next/link";
import { Globe, MapPin, Network } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SponsorLogo } from "@/components/sponsors/sponsor-logo";
import type { DirectoryPage } from "@/lib/sponsors/directory";
import { directoryHref } from "@/lib/sponsors/directory-rules";
import { normalizarSitioWeb, normalizarUsuarioRed, urlDeUsuario } from "@/lib/membership/social";
import { sumarDesdeRedAction } from "../actions";
import { FiltrosDelDirectorio } from "./filtros";

function sitio(valor: string | null): string | null {
  const r = normalizarSitioWeb(valor);
  return r.ok && r.valor ? r.valor : null;
}

function instagram(valor: string | null): { url: string; usuario: string } | null {
  const r = normalizarUsuarioRed("instagram", valor);
  return r.ok && r.valor ? { url: urlDeUsuario("instagram", r.valor), usuario: r.valor } : null;
}

function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** La pantalla del directorio, sin lecturas: recibe la página ya resuelta. */
export function DirectorioDeLaRed({
  r,
  puedeSumar,
  error,
}: {
  r: DirectoryPage;
  puedeSumar: boolean;
  error: string | null;
}) {
  const f = r.filtros;
  const aqui = directoryHref(f);
  const hayFiltros = Boolean(f.q || f.tipo || f.provincia || f.ciudad || f.ocultarVinculados);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buscar en la red DNX"
        description="Las marcas que ya acompañan a otras instituciones y plataformas de DNX. Al sumarla, usás la misma ficha y el mismo logo: no se copia nada, y vos elegís en qué espacios aparece."
        actions={
          <Link href="/sponsors" className="fo-btn fo-btn-secondary text-sm">
            Volver a mis sponsors
          </Link>
        }
      />

      {error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <FiltrosDelDirectorio
        valores={{ q: f.q, tipo: f.tipo, provincia: f.provincia, ciudad: f.ciudad, ocultar: f.ocultarVinculados }}
        tipos={r.opciones.tipos}
        provincias={r.opciones.provincias}
        ciudades={r.opciones.ciudades}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--fo-muted)]">
        <p aria-live="polite">
          {r.total === 0
            ? "Ninguna marca coincide."
            : r.total === 1
              ? "1 marca"
              : `${r.total} marcas`}
          {r.pageCount > 1 ? ` · página ${r.page} de ${r.pageCount}` : ""}
        </p>
        {hayFiltros ? (
          <Link href="/sponsors/red" className="underline-offset-2 hover:underline">
            Limpiar filtros
          </Link>
        ) : null}
      </div>

      {r.items.length === 0 ? (
        <div className="fo-card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Network className="size-6" aria-hidden />
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[var(--fo-muted)]">
            {hayFiltros
              ? "Probá con otro nombre o sacá algún filtro."
              : "Todavía no hay marcas públicas en la red."}{" "}
            Si la marca no está, la podés cargar vos.
          </p>
          {puedeSumar ? (
            <Link href="/sponsors/nuevo" className="fo-btn fo-btn-secondary text-sm">
              Cargar una marca nueva
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {r.items.map((m) => {
            const web = sitio(m.websiteUrl);
            const ig = instagram(m.instagram);
            const lugar = [m.city, m.province && m.province !== m.city ? m.province : null].filter(Boolean).join(", ");
            return (
              <li key={m.id} className="fo-card flex h-full flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <SponsorLogo name={m.name} src={m.logoSrc} className="size-14" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium leading-snug">{m.name}</p>
                    <p className="text-xs text-[var(--fo-muted)]">
                      {m.tipoLabel}
                      {lugar ? (
                        <>
                          {" · "}
                          <MapPin className="inline size-3 align-[-1px]" aria-hidden /> {lugar}
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
                {m.description ? (
                  <p className="line-clamp-3 text-sm leading-relaxed text-[var(--fo-text-secondary)]">{m.description}</p>
                ) : null}
                {web || ig ? (
                  <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {web ? (
                      <a href={web} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--fo-accent)] hover:underline">
                        <Globe className="size-3" aria-hidden />
                        {dominio(web)}
                      </a>
                    ) : null}
                    {ig ? (
                      <a href={ig.url} target="_blank" rel="noopener noreferrer" className="text-[var(--fo-accent)] hover:underline">
                        @{ig.usuario}
                      </a>
                    ) : null}
                  </p>
                ) : null}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                  {m.linked ? (
                    <>
                      <span className="rounded-full bg-[var(--fo-accent-muted)] px-2.5 py-1 text-xs font-medium text-[var(--fo-accent)]">
                        Ya está en tu lista
                      </span>
                      <Link href={`/sponsors/${m.id}`} className="fo-btn fo-btn-ghost text-sm">
                        Ver ficha
                      </Link>
                    </>
                  ) : puedeSumar ? (
                    <form action={sumarDesdeRedAction} className="ml-auto">
                      <input type="hidden" name="partnerId" value={m.id} />
                      <input type="hidden" name="volver" value={aqui} />
                      <button type="submit" className="fo-btn fo-btn-primary text-sm">
                        Agregar a mis sponsors
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {r.pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-2" aria-label="Páginas del directorio">
          {r.page > 1 ? (
            <Link href={directoryHref(f, { page: r.page - 1 })} className="fo-btn fo-btn-secondary text-sm" scroll>
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-[var(--fo-muted)]">
            Página {r.page} de {r.pageCount}
          </span>
          {r.page < r.pageCount ? (
            <Link href={directoryHref(f, { page: r.page + 1 })} className="fo-btn fo-btn-secondary text-sm" scroll>
              Siguiente
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
