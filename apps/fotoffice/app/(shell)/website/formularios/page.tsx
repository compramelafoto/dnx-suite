import Link from "next/link";
import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { WebsiteShell } from "@/components/website/website-shell";
import { filtrosDeLaBandeja, hrefDeLaBandeja, type FiltrosBandeja } from "@/lib/website/formularios";
import { fechaHoraArgentina } from "@/lib/website/formularios-csv";
import {
  detalleEnvio,
  ENVIOS_POR_PAGINA,
  listarEnvios,
  listarSuscriptores,
  resumenFormularios,
  SUSCRIPTORES_POR_PAGINA,
  type FormularioResumen,
} from "@/lib/website/formularios.server";
import { whatsappHref } from "@/lib/website/contact";
import { TablaEnvios, DetalleAcciones, FilaSuscriptor } from "@/components/website/formularios/bandeja-cliente";

export const dynamic = "force-dynamic";

/**
 * Sitio web → Formularios: la bandeja de los formularios propios del sitio (bloque FORM) y de lo
 * importado del Inbox de Prosite, y los suscriptores del boletín. Lleva datos personales: sólo la
 * ve quien puede editar el sitio. Spec: docs/superpowers/specs/2026-10-27-sitio-herramientas-prosite-design.md (PR C)
 */
export default async function WebsiteFormulariosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { workspace, canEdit, status, draftUpdatedAtIso } = await loadWebsiteCmsContext();
  const filtros = filtrosDeLaBandeja(await searchParams);

  return (
    <WebsiteShell workspaceId={workspace.id} status={status} canEdit={canEdit} draftUpdatedAt={draftUpdatedAtIso}>
      {canEdit ? (
        <Bandeja workspaceId={workspace.id} filtros={filtros} />
      ) : (
        <p className="fo-card text-sm text-[var(--fo-muted)]">Los envíos de los formularios tienen datos personales: sólo los ve quien puede editar el sitio.</p>
      )}
    </WebsiteShell>
  );
}

function FaltaTabla() {
  return (
    <p className="fo-card text-sm text-[var(--fo-danger)]" role="alert">
      Falta crear las tablas de formularios en la base. Avisale al administrador.
    </p>
  );
}

function Pestanas({ vista }: { vista: FiltrosBandeja["vista"] }) {
  const clase = (activa: boolean) =>
    ["px-3 py-1.5 text-sm rounded-lg", activa ? "bg-[var(--fo-accent)] text-white" : "text-[var(--fo-muted)] hover:text-[var(--fo-text)]"].join(" ");
  return (
    <div className="flex gap-2">
      <Link href={hrefDeLaBandeja({ vista: "envios" })} className={clase(vista === "envios")} aria-current={vista === "envios" ? "page" : undefined}>
        Envíos
      </Link>
      <Link href={hrefDeLaBandeja({ vista: "suscriptores" })} className={clase(vista === "suscriptores")} aria-current={vista === "suscriptores" ? "page" : undefined}>
        Suscriptores del boletín
      </Link>
    </div>
  );
}

async function Bandeja({ workspaceId, filtros }: { workspaceId: string; filtros: FiltrosBandeja }) {
  return (
    <div className="space-y-5">
      <div className="fo-card space-y-2">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Formularios</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Lo que la gente manda por los formularios de tu sitio (y lo que vino de la web anterior), agrupado por formulario. Podés
          marcarlo como leído, archivarlo, responder por correo o WhatsApp y bajarlo a Excel.
        </p>
        <Pestanas vista={filtros.vista} />
      </div>
      {filtros.vista === "suscriptores" ? <Suscriptores workspaceId={workspaceId} filtros={filtros} /> : <Envios workspaceId={workspaceId} filtros={filtros} />}
    </div>
  );
}

function Paginado({ total, porPagina, filtros }: { total: number; porPagina: number; filtros: FiltrosBandeja }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  const actual = Math.min(filtros.pagina, paginas);
  return (
    <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Páginas">
      {actual > 1 ? (
        <Link className="underline" href={hrefDeLaBandeja({ ...filtros, envioId: null, pagina: actual - 1 })}>
          ← Anteriores
        </Link>
      ) : (
        <span />
      )}
      <span className="text-[var(--fo-muted)]">
        Página {actual} de {paginas}
      </span>
      {actual < paginas ? (
        <Link className="underline" href={hrefDeLaBandeja({ ...filtros, envioId: null, pagina: actual + 1 })}>
          Siguientes →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function ListaDeFormularios({ formularios, filtros }: { formularios: FormularioResumen[]; filtros: FiltrosBandeja }) {
  const total = formularios.reduce((n, f) => n + f.total, 0);
  const nuevos = formularios.reduce((n, f) => n + f.nuevos, 0);
  const item = (id: string | null, nombre: string, cantidad: number, nuevosDe: number, importado = false) => {
    const activo = filtros.formularioId === id;
    return (
      <li key={id ?? "todos"}>
        <Link
          href={hrefDeLaBandeja({ vista: "envios", formularioId: id, estado: filtros.estado, q: filtros.q })}
          aria-current={activo ? "page" : undefined}
          className={["flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm", activo ? "bg-[var(--fo-surface-muted)] font-medium" : ""].join(" ")}
        >
          <span className="min-w-0 truncate">
            {nombre}
            {importado ? <span className="ml-1 text-xs text-[var(--fo-muted)]">(Prosite)</span> : null}
          </span>
          <span className="shrink-0 text-xs text-[var(--fo-muted)]">
            {cantidad}
            {nuevosDe > 0 ? <span className="ml-1 rounded-full bg-[var(--fo-accent)] px-1.5 text-white">{nuevosDe}</span> : null}
          </span>
        </Link>
      </li>
    );
  };
  return (
    <aside className="fo-card space-y-3 self-start">
      <ul className="space-y-1">
        {item(null, "Todos", total, nuevos)}
        {formularios.map((f) => item(f.id, f.nombre, f.total, f.nuevos, f.origen === "IMPORTADO_PROSITE"))}
      </ul>
      <div className="space-y-1 border-t border-[var(--fo-border)] pt-3 text-sm">
        {/* Descarga directa: un enlace común, sin JavaScript. */}
        <a className="underline" href={`/website/formularios/exportar?formulario=${filtros.formularioId ?? "todos"}`}>
          Exportar a Excel (CSV)
        </a>
        <p className="fo-helper">{filtros.formularioId ? "Todos los envíos de este formulario." : "Todos los envíos de todos los formularios."}</p>
      </div>
    </aside>
  );
}

async function Envios({ workspaceId, filtros }: { workspaceId: string; filtros: FiltrosBandeja }) {
  const [formularios, lista, detalle] = await Promise.all([
    resumenFormularios(workspaceId),
    listarEnvios(workspaceId, { formularioId: filtros.formularioId, estado: filtros.estado, q: filtros.q }, filtros.pagina),
    filtros.envioId ? detalleEnvio(workspaceId, filtros.envioId) : Promise.resolve(null),
  ]);
  if (formularios === null || lista === null) return <FaltaTabla />;
  if (formularios.length === 0) {
    return (
      <p className="fo-card text-sm text-[var(--fo-muted)]">
        Todavía no llegó ningún envío. Agregá la sección «Formulario» a una página del sitio, publicalo, y los envíos van a aparecer acá.
      </p>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
      <ListaDeFormularios formularios={formularios} filtros={filtros} />
      <div className="min-w-0 space-y-4">
        <form className="fo-card flex flex-wrap items-end gap-3" action="/website/formularios" method="get">
          {filtros.formularioId ? <input type="hidden" name="formulario" value={filtros.formularioId} /> : null}
          <label className="block space-y-1">
            <span className="fo-label">Estado</span>
            <select name="estado" className="fo-input" defaultValue={filtros.estado ?? ""}>
              <option value="">Sin archivar</option>
              <option value="NUEVO">Nuevos</option>
              <option value="LEIDO">Leídos</option>
              <option value="ARCHIVADO">Archivados</option>
              <option value="TODOS">Todos</option>
            </select>
          </label>
          <label className="block min-w-[12rem] flex-1 space-y-1">
            <span className="fo-label">Buscar</span>
            <input name="q" className="fo-input" defaultValue={filtros.q} placeholder="Nombre, correo o teléfono" maxLength={100} />
          </label>
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Filtrar
          </button>
        </form>

        {detalle ? <Detalle detalle={detalle} filtros={filtros} /> : null}

        <div className="fo-card space-y-3">
          <p className="text-sm text-[var(--fo-muted)]">{lista.total === 1 ? "1 envío" : `${lista.total.toLocaleString("es-AR")} envíos`}</p>
          {lista.filas.length === 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">No hay envíos con estos filtros.</p>
          ) : (
            <TablaEnvios
              filas={lista.filas.map((f) => ({
                id: f.id,
                formulario: f.formulario,
                nombre: f.nombre,
                email: f.email,
                telefono: f.telefono,
                estado: f.estado,
                fecha: f.fechaDesconocida ? "sin fecha" : fechaHoraArgentina(f.createdAt),
                resumen: f.resumen,
                href: hrefDeLaBandeja({ ...filtros, envioId: f.id }),
              }))}
              mostrarFormulario={!filtros.formularioId}
            />
          )}
          <Paginado total={lista.total} porPagina={ENVIOS_POR_PAGINA} filtros={filtros} />
        </div>
      </div>
    </div>
  );
}

function Detalle({ detalle, filtros }: { detalle: NonNullable<Awaited<ReturnType<typeof detalleEnvio>>>; filtros: FiltrosBandeja }) {
  const saludo = detalle.nombre ? `Hola ${detalle.nombre.split(" ")[0]}, ` : "Hola, ";
  const wa = detalle.telefono ? whatsappHref(detalle.telefono, `${saludo}te escribimos por lo que nos mandaste en «${detalle.formulario}».`) : null;
  const mail = detalle.email ? `mailto:${encodeURIComponent(detalle.email)}?subject=${encodeURIComponent(`Re: ${detalle.formulario}`)}` : null;
  return (
    <section className="fo-card space-y-4" aria-label="Detalle del envío">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--fo-text)]">{detalle.nombre || detalle.email || detalle.telefono || "Envío sin nombre"}</h3>
          <p className="fo-helper">
            {detalle.formulario} · {detalle.fechaDesconocida ? "sin fecha" : fechaHoraArgentina(detalle.createdAt)}
            {detalle.paginaUrl ? ` · desde ${detalle.paginaUrl}` : ""}
          </p>
        </div>
        <Link href={hrefDeLaBandeja({ ...filtros, envioId: null })} className="text-sm underline">
          Cerrar
        </Link>
      </div>
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[12rem_1fr]">
        {detalle.pares.map((p, i) => (
          <div key={i} className="contents">
            <dt className="text-[var(--fo-muted)]">{p.etiqueta}</dt>
            <dd className="whitespace-pre-line break-words text-[var(--fo-text)]">{p.valor}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        {mail ? (
          <a className="fo-btn fo-btn-primary text-sm" href={mail}>
            Responder por correo
          </a>
        ) : null}
        {wa ? (
          <a className="fo-btn fo-btn-secondary text-sm" href={wa} target="_blank" rel="noopener noreferrer">
            Responder por WhatsApp
          </a>
        ) : null}
        {detalle.consultaId ? (
          <Link className="fo-btn fo-btn-secondary text-sm" href={`/consultas/${detalle.consultaId}`}>
            Ver la consulta
          </Link>
        ) : null}
        <DetalleAcciones id={detalle.id} estado={detalle.estado} />
      </div>
    </section>
  );
}

async function Suscriptores({ workspaceId, filtros }: { workspaceId: string; filtros: FiltrosBandeja }) {
  const lista = await listarSuscriptores(workspaceId, { estado: filtros.estadoSuscriptor, q: filtros.q }, filtros.pagina);
  if (lista === null) return <FaltaTabla />;
  return (
    <div className="space-y-4">
      <form className="fo-card flex flex-wrap items-end gap-3" action="/website/formularios" method="get">
        <input type="hidden" name="vista" value="suscriptores" />
        <label className="block space-y-1">
          <span className="fo-label">Estado</span>
          <select name="estado" className="fo-input" defaultValue={filtros.estadoSuscriptor}>
            <option value="ACTIVO">Activos</option>
            <option value="BAJA">Dados de baja</option>
            <option value="TODOS">Todos</option>
          </select>
        </label>
        <label className="block min-w-[12rem] flex-1 space-y-1">
          <span className="fo-label">Buscar</span>
          <input name="q" className="fo-input" defaultValue={filtros.q} placeholder="Correo o nombre" maxLength={100} />
        </label>
        <button type="submit" className="fo-btn fo-btn-primary text-sm">
          Filtrar
        </button>
        <a className="text-sm underline" href="/website/formularios/exportar?tipo=suscriptores">
          Exportar a Excel (CSV)
        </a>
      </form>
      <div className="fo-card space-y-3">
        <p className="text-sm text-[var(--fo-muted)]">
          {lista.activos === 1 ? "1 suscriptor activo" : `${lista.activos.toLocaleString("es-AR")} suscriptores activos`}
          {lista.total !== lista.activos ? ` · ${lista.total.toLocaleString("es-AR")} con estos filtros` : ""}
        </p>
        {lista.filas.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hay suscriptores con estos filtros. Se suman con la sección «Boletín» del sitio.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)]">
            {lista.filas.map((s) => (
              <FilaSuscriptor key={s.id} id={s.id} email={s.email} nombre={s.nombre} estado={s.estado} fecha={fechaHoraArgentina(s.createdAt)} />
            ))}
          </ul>
        )}
        <Paginado total={lista.total} porPagina={SUSCRIPTORES_POR_PAGINA} filtros={filtros} />
      </div>
    </div>
  );
}
