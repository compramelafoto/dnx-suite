import type { Metadata } from "next";
import Link from "next/link";
import {
  alertFiltersOf,
  describeAlert,
  hasAlertFilters,
  type AlertFilters,
} from "@/lib/catalogo/alertas";
import {
  PAGE_SIZE,
  parseCatalogFilters,
  searchListings,
  type CatalogFilters,
} from "@/lib/catalogo/buscar";
import { KIND_LABELS } from "@/lib/inventario/equipos";
import { MONTURAS, PROVINCIAS } from "@/lib/publicaciones/catalogos";
import { Boton, Campo, Pagina } from "@/app/_ui";
import { MARCA } from "@/app/_ui/marca";
import { crearAlerta } from "@/app/alertas/actions";
import { TarjetaEquipo } from "./TarjetaEquipo";

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

/**
 * «Avisarme cuando aparezca»: guarda los filtros actuales como alerta. Sin filtros (o sólo con
 * «precio desde», que la alerta no guarda) invita a filtrar primero.
 */
function AvisoAlerta({ a }: { a: AlertFilters }) {
  if (!hasAlertFilters(a)) {
    return (
      <p className="texto-secundario alerta-busqueda">
        ¿Buscás algo puntual? Elegí un tipo, una marca, una montura, un precio máximo o una
        provincia y te avisamos por correo cuando se publique.
      </p>
    );
  }
  return (
    <form action={crearAlerta} className="superficie alerta-busqueda">
      {a.kind ? <input type="hidden" name="kind" value={a.kind} /> : null}
      {a.make ? <input type="hidden" name="make" value={a.make} /> : null}
      {a.mount ? <input type="hidden" name="mount" value={a.mount} /> : null}
      {a.maxPrice !== undefined ? <input type="hidden" name="maxPrice" value={a.maxPrice} /> : null}
      {a.province ? <input type="hidden" name="province" value={a.province} /> : null}
      <p>
        ¿No encontrás lo que buscás? Te avisamos por correo cuando se publique:{" "}
        <strong>
          {describeAlert({
            kind: a.kind ?? null,
            make: a.make ?? null,
            mount: a.mount ?? null,
            maxPriceArs: a.maxPrice ?? null,
            province: a.province ?? null,
          })}
        </strong>
        .
      </p>
      <Boton variante="secundario">Avisarme cuando aparezca</Boton>
    </form>
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

          <AvisoAlerta a={alertFiltersOf(f)} />

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
                <TarjetaEquipo key={l.id} l={l} />
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
