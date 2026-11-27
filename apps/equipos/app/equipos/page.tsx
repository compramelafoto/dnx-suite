import type { Metadata } from "next";
import Link from "next/link";
import {
  formatPesos,
  PAGE_SIZE,
  parseCatalogFilters,
  searchListings,
  type CatalogFilters,
  type PublicListing,
} from "@/lib/catalogo/buscar";
import { KIND_LABELS } from "@/lib/inventario/equipos";
import { CONDITION_LABELS, MONTURAS, PROVINCIAS } from "@/lib/publicaciones/catalogos";
import { Boton, Campo, MedidorConfianza, Pagina, SelloIdentidad, SinFoto } from "@/app/_ui";
import { MARCA } from "@/app/_ui/marca";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Equipos usados en venta — ${MARCA}`,
  description: "Cámaras, lentes y accesorios usados de fotógrafos con identidad verificada.",
};

/** Arma el enlace a otra página conservando los filtros elegidos. */
function hrefPagina(f: CatalogFilters, page: number): string {
  const q = new URLSearchParams();
  if (f.kind) q.set("kind", f.kind);
  if (f.make) q.set("make", f.make);
  if (f.mount) q.set("mount", f.mount);
  if (f.minPrice !== undefined) q.set("minPrice", String(f.minPrice));
  if (f.maxPrice !== undefined) q.set("maxPrice", String(f.maxPrice));
  if (f.province) q.set("province", f.province);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/equipos?${s}` : "/equipos";
}

function hayFiltros(f: CatalogFilters): boolean {
  return Object.keys(f).some((k) => k !== "page");
}

function Filtros({ f }: { f: CatalogFilters }) {
  return (
    <form className="filtros" action="/equipos" method="get" aria-label="Filtrar equipos">
      <h2 className="filtros-titulo">Filtrar</h2>
      <Campo etiqueta="Tipo de equipo">
        <select className="control" name="kind" defaultValue={f.kind ?? ""}>
          <option value="">Todos</option>
          {Object.entries(KIND_LABELS).map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Marca">
        <input
          className="control"
          name="make"
          type="search"
          defaultValue={f.make ?? ""}
          placeholder="Canon, Nikon, Sony"
          autoComplete="off"
        />
      </Campo>
      <Campo etiqueta="Montura">
        <select className="control" name="mount" defaultValue={f.mount ?? ""}>
          <option value="">Todas</option>
          {MONTURAS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Campo>
      <div className="filtros-precios">
        <Campo etiqueta="Precio desde">
          <input
            className="control"
            name="minPrice"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={f.minPrice ?? ""}
          />
        </Campo>
        <Campo etiqueta="Precio hasta">
          <input
            className="control"
            name="maxPrice"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={f.maxPrice ?? ""}
          />
        </Campo>
      </div>
      <Campo etiqueta="Provincia">
        <select className="control" name="province" defaultValue={f.province ?? ""}>
          <option value="">Todo el país</option>
          {PROVINCIAS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Campo>
      <div className="acciones">
        <Boton>Ver resultados</Boton>
        {hayFiltros(f) ? (
          <Link className="filtros-limpiar" href="/equipos">
            Quitar filtros
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function Resultado({ l }: { l: PublicListing }) {
  const href = `/equipos/${l.id}`;
  return (
    <li className="resultado">
      <Link className="resultado-imagen" href={href} tabIndex={-1} aria-hidden="true">
        {l.photoUrls[0] ? (
          // Las URL firmadas vencen: no pasan por el optimizador de imágenes.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="resultado-foto" src={l.photoUrls[0]} alt="" loading="lazy" />
        ) : (
          <SinFoto
            tipo={KIND_LABELS[l.kind]}
            titulo={`${l.make} ${l.model}`}
            className="resultado-foto"
          />
        )}
      </Link>
      <div className="resultado-cuerpo">
        <h2 className="resultado-titulo">
          <Link href={href}>
            {l.make} {l.model}
          </Link>
        </h2>
        <p className="resultado-detalle">
          {KIND_LABELS[l.kind]} · {CONDITION_LABELS[l.condition]}
          {l.mount ? ` · ${l.mount}` : ""}
        </p>
        <p className="resultado-zona">
          {l.city}, {l.province}
        </p>
      </div>
      <div className="resultado-lado">
        <p className="resultado-precio">{formatPesos(l.priceArs)}</p>
        <MedidorConfianza level={l.trust.level} size="chico" />
        <SelloIdentidad />
      </div>
    </li>
  );
}

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const f = parseCatalogFilters(await searchParams);
  const { items, total } = await searchListings(f);
  const paginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Un enlace armado a mano puede pedir una página que no existe.
  const fueraDeRango = f.page > paginas;

  return (
    <Pagina
      titulo="Equipos en venta"
      bajada="Todos los vendedores verificaron su identidad. Cada publicación separa lo que comprobó el portal de lo que declara el vendedor."
      ancho="ancha"
      foto="lentes"
    >
      <div className="catalogo">
        <Filtros f={f} />

        <section className="resultados" aria-labelledby="resultados-titulo">
          <h2 id="resultados-titulo" className="resultados-cantidad">
            {total === 0
              ? "No hay equipos publicados"
              : total === 1
                ? "1 equipo publicado"
                : `${total.toLocaleString("es-AR")} equipos publicados`}
          </h2>

          {fueraDeRango ? (
            <p className="texto-secundario">
              Esta página no existe.{" "}
              <Link href={hrefPagina(f, paginas)}>
                {paginas === 1 ? "Ir a la primera página" : `Ir a la última página (${paginas})`}
              </Link>
            </p>
          ) : items.length === 0 ? (
            <p className="texto-secundario">
              {hayFiltros(f)
                ? "Ningún equipo coincide con estos filtros. Probá quitando alguno."
                : "Todavía no hay equipos a la venta. Volvé a mirar en unos días."}
            </p>
          ) : (
            <ul className="resultados-lista">
              {items.map((l) => (
                <Resultado key={l.id} l={l} />
              ))}
            </ul>
          )}

          {paginas > 1 && !fueraDeRango ? (
            <nav className="paginacion" aria-label="Páginas de resultados">
              {f.page > 1 ? (
                <Link href={hrefPagina(f, f.page - 1)} rel="prev">
                  ← Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="texto-secundario">
                Página {f.page} de {paginas}
              </span>
              {f.page < paginas ? (
                <Link href={hrefPagina(f, f.page + 1)} rel="next">
                  Siguiente →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>
      </div>
    </Pagina>
  );
}
