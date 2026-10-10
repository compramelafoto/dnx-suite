import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ConfiguracionGaleria } from "@/components/galerias/configuracion-galeria";
import { PestanaClientes } from "@/components/galerias/pestana-clientes";
import { PestanaFotos } from "@/components/galerias/pestana-fotos";
import { puedeEnContexto } from "@/lib/access/policy";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { fechaHoraBA } from "@/lib/ficha/formato";
import { puedeGestionarGalerias } from "@/lib/galerias/acceso";
import { listarClientesDeGaleria } from "@/lib/galerias/clientes";
import { ETIQUETA_ESTADO_GALERIA, ETIQUETA_MODO_DESCARGA, ETIQUETA_MODO_SELECCION } from "@/lib/galerias/constantes";
import { claseDeEstadoGaleria } from "@/lib/galerias/estado-vista";
import { listarFotos } from "@/lib/galerias/fotos";
import { cargarFichaGaleria } from "@/lib/galerias/galerias";
import { cargarHistorial } from "@/lib/galerias/historial";
import { requireGalerias } from "@/lib/galerias/requerir";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";

export const dynamic = "force-dynamic";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
function paginaPedida(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

const PESTANAS = [
  { clave: "fotos", etiqueta: "Fotos" },
  { clave: "clientes", etiqueta: "Clientes" },
  { clave: "configuracion", etiqueta: "Configuración" },
  { clave: "historial", etiqueta: "Historial" },
] as const;
type Pestana = (typeof PESTANAS)[number]["clave"];

/**
 * Ficha de una galería, con pestañas por la dirección (`?tab=`): Fotos, Clientes, Configuración e Historial.
 * Primero la guarda (módulo encendido y "Ver"), después la lectura acotada al workspace de la sesión: una
 * galería de otro workspace o inexistente cae en `notFound()`. Sólo se lee lo de la pestaña abierta (las
 * URLs firmadas de las miniaturas, por ejemplo, sólo se arman en "Fotos"). Con "Gestionar" se sube, ordena,
 * publica y comparte; el servidor lo vuelve a decidir en cada acción.
 */
export default async function FichaGaleriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ctx } = await requireGalerias("ver");
  const { id } = await params;
  if (!ID_VALIDO.test(id)) notFound();
  const ficha = await cargarFichaGaleria(ctx, id);
  if (!ficha) notFound();

  const pedida = (await searchParams).tab;
  const pestana: Pestana = PESTANAS.find((p) => p.clave === (Array.isArray(pedida) ? pedida[0] : pedida))?.clave ?? "fotos";
  const gestiona = puedeGestionarGalerias(ctx);
  const veProyecto = puedeEnContexto(ctx, "ver", PROJECTS_MODULE_KEY);
  const veContactos = puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY);

  // Los clientes se leen siempre: el encabezado cuenta cuántos esperan revisión.
  const clientes = await listarClientesDeGaleria(ctx, id);
  const enRevision = clientes.filter((c) => c.estado === "EN_REVISION" && !c.anulado).length;

  const fotos = pestana === "fotos" ? await listarFotos(ctx, id) : [];
  const pagina = pestana === "historial" ? paginaPedida((await searchParams).pagina) : 1;
  const historial = pestana === "historial" ? await cargarHistorial(ctx, id, pagina) : { items: [], pagina: 1, hayMas: false };
  const sugerido =
    veContactos && !clientes.some((c) => c.clientId === ficha.contacto.id)
      ? { id: ficha.contacto.id, nombre: ficha.contacto.nombre, email: ficha.contacto.email, telefono: ficha.contacto.telefono }
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={ficha.nombre}
        description={`Galería N° ${ficha.numero} · ${ficha.contacto.nombre}`}
        actions={
          <Link href="/galerias" className="fo-btn fo-btn-secondary text-sm">
            Volver a Galerías
          </Link>
        }
      />

      {enRevision > 0 ? (
        <div role="status" className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          {enRevision === 1 ? "1 cliente envió su selección y está esperando tu revisión." : `${enRevision} clientes enviaron su selección y están esperando tu revisión.`}{" "}
          <Link href="?tab=clientes" className="font-medium underline">
            Ver clientes
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)]">
        <div className="min-w-0 space-y-4 self-start">
          <section aria-labelledby="datos-galeria-titulo" className="fo-card space-y-3 p-4">
            <h2 id="datos-galeria-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
              Datos
            </h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Estado</dt>
                <dd>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseDeEstadoGaleria(ficha.estado)}`}>{ETIQUETA_ESTADO_GALERIA[ficha.estado]}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Proyecto</dt>
                <dd>
                  {veProyecto ? (
                    <Link href={`/proyectos/${encodeURIComponent(ficha.proyecto.id)}`} className="text-[var(--fo-text)] hover:underline">
                      N° {ficha.proyecto.numero} · {ficha.proyecto.nombre}
                    </Link>
                  ) : (
                    `N° ${ficha.proyecto.numero} · ${ficha.proyecto.nombre}`
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Contacto del proyecto</dt>
                <dd>
                  {veContactos ? (
                    <Link href={`/clientes/${encodeURIComponent(ficha.contacto.id)}`} className="text-[var(--fo-text)] hover:underline">
                      {ficha.contacto.nombre}
                    </Link>
                  ) : (
                    ficha.contacto.nombre
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Fotos</dt>
                <dd>
                  {ficha.fotos.listas.toLocaleString("es-AR")} listas
                  {ficha.fotos.pendientes > 0 ? ` · ${ficha.fotos.pendientes} pendientes` : ""}
                  {ficha.fotos.conError > 0 ? ` · ${ficha.fotos.conError} con error` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Selección</dt>
                <dd>
                  {ETIQUETA_MODO_SELECCION[ficha.selectionMode]}
                  {ficha.selectionMode === "CANTIDAD"
                    ? ` (${[ficha.minSelect !== null ? `mín. ${ficha.minSelect}` : null, ficha.maxSelect !== null ? `máx. ${ficha.maxSelect}` : null].filter(Boolean).join(" · ")})`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Comentarios</dt>
                <dd>{ficha.allowComments ? "Sí" : "No"}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Descarga</dt>
                <dd>{ETIQUETA_MODO_DESCARGA[ficha.downloadMode]}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--fo-muted)]">Creada</dt>
                <dd>{fechaHoraBA(ficha.createdAt)}</dd>
              </div>
              {ficha.publishedAt ? (
                <div>
                  <dt className="text-xs text-[var(--fo-muted)]">Publicada</dt>
                  <dd>{fechaHoraBA(ficha.publishedAt)}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        </div>

        <div className="min-w-0 space-y-4">
          <nav aria-label="Secciones de la galería" className="flex flex-wrap gap-1 border-b border-[var(--fo-border)]">
            {PESTANAS.map((p) => {
              const activa = p.clave === pestana;
              return (
                <Link
                  key={p.clave}
                  href={`/galerias/${encodeURIComponent(ficha.id)}?tab=${p.clave}`}
                  aria-current={activa ? "page" : undefined}
                  className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium ${
                    activa ? "border-[var(--fo-accent,#1d4ed8)] text-[var(--fo-text)]" : "border-transparent text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
                  }`}
                >
                  {p.etiqueta}
                  {p.clave === "clientes" && clientes.length > 0 ? ` (${clientes.length})` : ""}
                </Link>
              );
            })}
          </nav>

          {pestana === "fotos" ? (
            <PestanaFotos
              key={ficha.id}
              galeriaId={ficha.id}
              fotosIniciales={fotos}
              orderMode={ficha.orderMode}
              coverFotoId={ficha.coverFotoId}
              archivada={ficha.estado === "ARCHIVADA"}
              puedeGestionar={gestiona}
            />
          ) : null}

          {pestana === "clientes" ? (
            <PestanaClientes
              galeriaId={ficha.id}
              estadoGaleria={ficha.estado}
              clientes={clientes.map((c) => ({
                id: c.id,
                clientId: c.clientId,
                nombre: c.nombre,
                email: c.email,
                telefono: c.telefono,
                estado: c.estado,
                anulado: c.anulado,
                elegidas: c.elegidas,
                ultimaVez: c.ultimaVez?.toISOString() ?? null,
                enviadoEn: c.enviadoEn?.toISOString() ?? null,
                finalizadoEn: c.finalizadoEn?.toISOString() ?? null,
              }))}
              sugerido={sugerido}
              puedeGestionar={gestiona}
              puedeBuscarContactos={veContactos}
            />
          ) : null}

          {pestana === "configuracion" ? (
            <ConfiguracionGaleria
              key={`${ficha.id}:${ficha.estado}`}
              galeriaId={ficha.id}
              estado={ficha.estado}
              fotosListas={ficha.fotos.listas}
              puedeGestionar={gestiona}
              inicial={{
                nombre: ficha.nombre,
                mensaje: ficha.mensaje ?? "",
                selectionMode: ficha.selectionMode,
                minSelect: ficha.minSelect,
                maxSelect: ficha.maxSelect,
                allowComments: ficha.allowComments,
                downloadMode: ficha.downloadMode,
              }}
            />
          ) : null}

          {pestana === "historial" ? (
            <section aria-labelledby="historial-galeria-titulo" className="fo-card space-y-3 p-4">
              <h2 id="historial-galeria-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
                Historial
              </h2>
              {historial.items.length === 0 ? (
                <p className="text-sm text-[var(--fo-muted)]">Todavía no pasó nada con esta galería.</p>
              ) : (
                <ul className="space-y-4 text-sm">
                  {historial.items.map((e) => (
                    <li key={e.id} className="space-y-0.5">
                      <p className="text-xs text-[var(--fo-muted)]">
                        <time dateTime={e.fecha}>{fechaHoraBA(e.fecha)}</time>
                        {e.actor ? ` · ${e.actor}` : ""}
                      </p>
                      <p className="text-[var(--fo-text)]">
                        {e.etiqueta}
                        {e.cliente ? ` — ${e.cliente}` : ""}
                        {e.detalle ? <span className="text-[var(--fo-muted)]"> ({e.detalle})</span> : null}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {historial.pagina > 1 || historial.hayMas ? (
                <nav aria-label="Páginas del historial" className="flex items-center justify-between gap-2 border-t border-[var(--fo-border)] pt-3 text-sm">
                  {historial.pagina > 1 ? (
                    <Link href={`/galerias/${encodeURIComponent(ficha.id)}?tab=historial&pagina=${historial.pagina - 1}`} className="fo-btn fo-btn-secondary text-sm">
                      Más nuevos
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs text-[var(--fo-muted)]">Página {historial.pagina}</span>
                  {historial.hayMas ? (
                    <Link href={`/galerias/${encodeURIComponent(ficha.id)}?tab=historial&pagina=${historial.pagina + 1}`} className="fo-btn fo-btn-secondary text-sm">
                      Más antiguos
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
