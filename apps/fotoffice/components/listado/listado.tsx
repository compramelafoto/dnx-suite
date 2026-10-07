import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { exigirCapacidad } from "@/lib/listado/acceso";
import { recortarPorDinero } from "@/lib/listado/dinero";
import { escribirConsulta, hayConsultaEnDireccion, leerConsulta, type CambiosConsulta } from "@/lib/listado/consulta";
import { ejecutarListado, resolverConsulta } from "@/lib/listado/ejecutar";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import type { ContextoListado, DefinicionListado } from "@/lib/listado/tipos";
import { guardarUltima, leerUltima, listarVistas } from "@/lib/listado/vistas";
import { BarraDeFiltros, type FiltroVisible } from "./barra-de-filtros";
import { BarraDeSeleccion } from "./barra-de-seleccion";
import { CajaDeBusqueda, CajaDeBusquedaQuieta } from "./caja-de-busqueda";
import { EtiquetasDeFiltro } from "./etiquetas-de-filtro";
import { MenuDeVistas } from "./menu-de-vistas";
import { Paginador } from "./paginador";
import { PanelLateral } from "./panel-lateral";
import { AvisoSeleccion, ProveedorSeleccion, type AccionVisible } from "./seleccion";
import { Tabla } from "./tabla";
import { destinoConAvisos, hrefListado } from "./util";

type Parametros = Record<string, string | string[] | undefined>;

function aURLSearchParams(p: Parametros): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (Array.isArray(v)) for (const x of v) sp.append(k, x);
    else if (v !== undefined) sp.append(k, v);
  }
  return sp;
}

const NOMBRES_RESERVADOS: Record<string, string> = { orden: "Orden", pagina: "Página", filas: "Filas por página" };

async function filtrosVisibles<F>(def: DefinicionListado<F>, ctx: ContextoListado, etiquetasRelacion: Record<string, string>) {
  const out: FiltroVisible[] = [];
  for (const f of def.filtros) {
    if (f.tipo === "periodo") out.push({ tipo: "periodo", clave: f.clave, etiqueta: f.etiqueta });
    else if (f.tipo === "opcion") out.push({ tipo: "lista", clave: f.clave, etiqueta: f.etiqueta, opciones: [...f.opciones] });
    else if (f.tipo === "siNo") {
      out.push({ tipo: "lista", clave: f.clave, etiqueta: f.etiqueta, opciones: [{ valor: "si", etiqueta: f.si }, { valor: "no", etiqueta: f.no }] });
    } else if (f.conBuscador) {
      out.push({ tipo: "buscador", clave: f.clave, etiqueta: f.etiqueta, etiquetaInicial: etiquetasRelacion[f.clave] ?? "" });
    } else {
      const opciones = def.opcionesRelacion ? await def.opcionesRelacion(ctx, f.clave) : [];
      if (opciones.length) out.push({ tipo: "lista", clave: f.clave, etiqueta: f.etiqueta, opciones });
    }
  }
  return out;
}

async function accionesVisibles<F>(def: DefinicionListado<F>, ctx: ContextoListado): Promise<AccionVisible[]> {
  const permitidas = def.acciones.filter((a) => exigirCapacidad(ctx, a.capacidad));
  return Promise.all(
    permitidas.map(async (a) => ({
      clave: a.clave,
      etiqueta: a.etiqueta,
      parametro: a.parametro?.fecha
        ? { etiqueta: a.parametro.etiqueta, fecha: true, opciones: [] }
        : a.parametro
          ? { etiqueta: a.parametro.etiqueta, opciones: await a.parametro.opciones(ctx) }
          : null,
    })),
  );
}

/**
 * Dibuja cualquier lista declarada con el motor: búsqueda, filtros, chips, vistas, tabla
 * ordenable, selección con acciones en lote, paginador y panel lateral. Cada página arma `ctx`
 * con su propia guarda; acá sólo se lee y se dibuja lo que el contexto permite.
 */
export async function Listado<F>({
  def: definicion,
  ctx,
  ruta,
  searchParams,
  encabezadoExtra,
}: {
  def: DefinicionListado<F>;
  ctx: ContextoListado;
  ruta: string;
  searchParams: Parametros | Promise<Parametros>;
  encabezadoExtra?: ReactNode;
}) {
  // Sin `verDinero` sobre su módulo, las columnas y filtros de plata no existen para esta persona.
  const def = recortarPorDinero(definicion, ctx);
  const sp = aURLSearchParams(await searchParams);
  const vistas = await listarVistas(ctx, def.clave);

  const idVista = sp.get("vista");
  if (idVista) {
    // Sólo vistas guardadas de esta lista y este workspace, propias o compartidas.
    const vista = vistas.find((v) => v.id === idVista);
    if (vista) redirect(destinoConAvisos(ruta, vista.query, sp));
  }
  if (sp.get("limpio") === "1") {
    await guardarUltima(ctx, def.clave, "");
  } else if (!hayConsultaEnDireccion(sp)) {
    const ultima = await leerUltima(ctx, def.clave);
    if (ultima) redirect(destinoConAvisos(ruta, ultima, sp));
  }

  const leida = leerConsulta(def, sp);
  const { resuelta, descartados: noResueltos } = await resolverConsulta(def, ctx, leida.consulta, hoyEnBuenosAires());
  const pagina = await ejecutarListado(def, ctx, resuelta);
  const consulta: typeof resuelta = { ...resuelta, pagina: pagina.pagina };
  const queryActual = escribirConsulta(def, consulta, { ver: null, pagina: 1 });
  if (!idVista) await guardarUltima(ctx, def.clave, queryActual);

  // Como en main: exportar es de quien gestiona el módulo. Las columnas de plata sólo salen con
  // `verDinero` (las saca `recortarPorDinero`).
  const puedeExportar = exigirCapacidad(ctx, "operar");
  const rutaExportar = `/api/listados/${encodeURIComponent(def.clave)}/exportar`;
  const [filtros, acciones, contenidoPanel, avisoDeLista] = await Promise.all([
    filtrosVisibles(def, ctx, resuelta.etiquetasRelacion),
    accionesVisibles(def, ctx),
    consulta.ver && def.panel ? def.panel(ctx, consulta.ver) : null,
    def.aviso ? def.aviso(ctx, resuelta) : null,
  ]);

  const etiquetaDe = new Map(def.filtros.map((f) => [f.clave, f.etiqueta]));
  const descartados = Array.from(new Set([...leida.descartados, ...noResueltos])).map(
    (k) => etiquetaDe.get(k) ?? NOMBRES_RESERVADOS[k] ?? k.slice(0, 40),
  );
  const conservar = Array.from(new URLSearchParams(escribirConsulta(def, { ...consulta, filtros: {} }, { ver: null, pagina: 1 })));
  const ids = pagina.filas.map((f) => def.idDe(f));
  const seleccionable = acciones.length > 0 || puedeExportar;
  const conFiltros = Boolean(consulta.q) || Object.keys(consulta.filtros).length > 0;
  const hrefDe = (cambios: CambiosConsulta) => hrefListado(ruta, escribirConsulta(def, consulta, cambios));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Suspense fallback={<CajaDeBusquedaQuieta valorInicial={consulta.q} placeholder={def.placeholderBusqueda} />}>
          <CajaDeBusqueda valorInicial={consulta.q} placeholder={def.placeholderBusqueda} />
        </Suspense>
        <MenuDeVistas
          clave={def.clave}
          ruta={ruta}
          vistas={vistas.map(({ id, name, shared, editable }) => ({ id, name, shared, editable }))}
          queryActual={queryActual}
          puedeCompartir={exigirCapacidad(ctx, "configurar")}
        />
        {puedeExportar ? (
          <a href={`${rutaExportar}${queryActual ? `?${queryActual}` : ""}`} className="fo-btn fo-btn-secondary">
            <Download className="size-4" aria-hidden />
            Exportar
          </a>
        ) : null}
        {encabezadoExtra ? <div className="ml-auto flex flex-wrap gap-2">{encabezadoExtra}</div> : null}
      </div>

      <BarraDeFiltros
        key={escribirConsulta(def, consulta, { ver: null, pagina: 1 })}
        lista={def.clave}
        ruta={ruta}
        filtros={filtros}
        valores={consulta.filtros}
        conservar={conservar}
      />

      {descartados.length ? (
        <p className="fo-alert-warning rounded-[var(--fo-radius-sm)] px-4 py-2 text-sm text-[var(--fo-text)]" role="status">
          Se ignoraron filtros que ya no existen: {descartados.join(", ")}.
        </p>
      ) : null}

      {avisoDeLista ? (
        <p className="fo-alert-warning rounded-[var(--fo-radius-sm)] px-4 py-2 text-sm text-[var(--fo-text)]" role="status">
          {avisoDeLista}
        </p>
      ) : null}

      <EtiquetasDeFiltro def={def} consulta={consulta} ruta={ruta} />

      <ProveedorSeleccion
        key={escribirConsulta(def, consulta, { ver: null })}
        idsDePagina={ids}
        total={pagina.total}
        clave={def.clave}
        query={queryActual}
        acciones={acciones}
        puedeExportar={puedeExportar}
        rutaExportar={rutaExportar}
      >
        <div className={contenidoPanel ? "grid items-start gap-4 lg:grid-cols-[1fr_420px]" : ""}>
          <div className="min-w-0 space-y-3">
            {seleccionable ? <AvisoSeleccion /> : null}
            {pagina.total === 0 ? (
              <Vacio plural={def.sustantivo.plural} conFiltros={conFiltros} ruta={ruta} />
            ) : (
              <Tabla def={def} filas={pagina.filas} consulta={consulta} ruta={ruta} seleccionable={seleccionable} />
            )}
            <Paginador
              pagina={pagina.pagina}
              paginas={pagina.paginas}
              desde={pagina.desde}
              hasta={pagina.hasta}
              total={pagina.total}
              sustantivo={def.sustantivo}
              filas={consulta.filas}
              hrefPagina={(n) => hrefDe({ pagina: n })}
              hrefFilas={(n) => hrefDe({ filas: n })}
            />
          </div>
          {contenidoPanel && consulta.ver ? (
            <PanelLateral
              key={consulta.ver}
              titulo={`Vista rápida de ${def.sustantivo.singular}`}
              hrefCerrar={hrefDe({ ver: null })}
              hrefAnterior={vecino(ids, consulta.ver, -1, (id) => hrefDe({ ver: id }))}
              hrefSiguiente={vecino(ids, consulta.ver, 1, (id) => hrefDe({ ver: id }))}
              hrefFicha={def.hrefFicha(consulta.ver)}
            >
              {contenidoPanel}
            </PanelLateral>
          ) : null}
        </div>
        {seleccionable ? <BarraDeSeleccion /> : null}
      </ProveedorSeleccion>
    </div>
  );
}

function vecino(ids: string[], actual: string, paso: number, href: (id: string) => string): string | null {
  const i = ids.indexOf(actual);
  const otro = i === -1 ? undefined : ids[i + paso];
  return otro ? href(otro) : null;
}

function Vacio({ plural, conFiltros, ruta }: { plural: string; conFiltros: boolean; ruta: string }) {
  return (
    <div className="rounded-[var(--fo-radius)] border border-dashed border-[var(--fo-border-strong)] bg-[var(--fo-surface)] px-6 py-12 text-center text-sm text-[var(--fo-muted)]">
      {conFiltros ? (
        <>
          <p>No hay resultados con estos filtros.</p>
          <Link href={`${ruta}?limpio=1`} className="mt-2 inline-block font-medium text-[var(--fo-accent)] hover:underline">
            Limpiar filtros
          </Link>
        </>
      ) : (
        <p>Todavía no hay {plural}.</p>
      )}
    </div>
  );
}

