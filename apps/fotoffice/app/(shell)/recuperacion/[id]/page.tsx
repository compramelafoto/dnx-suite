import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { InstruccionesPrograma } from "@/components/recuperacion/instrucciones-programa";
import { RefrescoAutomatico } from "@/components/recuperacion/refresco-automatico";
import { BorrarCaso } from "@/components/recuperacion/borrar-caso";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { appUrl } from "@/lib/app-url";
import { urlsDeMiniaturas } from "@/lib/recuperacion/casos";
import {
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO,
  MINUTOS_SIN_SENAL,
  RECUPERACION_PANEL_ROUTE,
  TIPOS_ARCHIVO,
  bytesLegibles,
  codigoLegible,
  comandoMac,
  diaDeToma,
  fechaTomaLegible,
  type EstadoRecuperacion,
  type TipoArchivoRecuperado,
} from "@/lib/recuperacion/constantes";

export const dynamic = "force-dynamic";

const POR_PAGINA = 120;

function diaLegible(dia: string): string {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

export default async function CasoRecuperacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tipo?: string; pagina?: string }>;
}) {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const nivel = await getModuleLevel(user.id, workspace.id, SALES_MODULE_KEY);
  if (!hasLevel(nivel, "VIEW")) redirect("/dashboard");

  const { id } = await params;
  const sp = await searchParams;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  const caso = await prisma.fotofficeRecuperacion.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!caso) notFound();

  const tipo = (TIPOS_ARCHIVO as readonly string[]).includes(sp.tipo ?? "") ? (sp.tipo as TipoArchivoRecuperado) : null;
  const pagina = Math.max(1, Math.min(10_000, Number.parseInt(sp.pagina ?? "1", 10) || 1));

  const [porTipo, porCamara, fechas, archivos, totalFiltrado] = await Promise.all([
    prisma.fotofficeRecuperacionArchivo.groupBy({ by: ["tipo"], where: { recuperacionId: caso.id }, _count: { _all: true }, _sum: { tamanio: true } }),
    prisma.fotofficeRecuperacionArchivo.groupBy({ by: ["camara"], where: { recuperacionId: caso.id, camara: { not: null } }, _count: { _all: true }, orderBy: { _count: { camara: "desc" } }, take: 6 }),
    prisma.fotofficeRecuperacionArchivo.findMany({ where: { recuperacionId: caso.id, fechaToma: { not: null } }, select: { fechaToma: true }, take: MAX_FECHAS }),
    prisma.fotofficeRecuperacionArchivo.findMany({
      where: { recuperacionId: caso.id, ...(tipo ? { tipo } : {}) },
      orderBy: { indice: "asc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: { id: true, indice: true, tipo: true, extension: true, tamanio: true, ancho: true, alto: true, fechaToma: true, camara: true, nombreLocal: true, miniaturaKey: true },
    }),
    prisma.fotofficeRecuperacionArchivo.count({ where: { recuperacionId: caso.id, ...(tipo ? { tipo } : {}) } }),
  ]);
  const miniaturas = await urlsDeMiniaturas(archivos);

  const dias = new Map<string, number>();
  for (const f of fechas) {
    const d = diaDeToma(f.fechaToma);
    if (d) dias.set(d, (dias.get(d) ?? 0) + 1);
  }
  const diasOrdenados = [...dias.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const estado = caso.estado as EstadoRecuperacion;
  const total = Number(caso.bytesTotales);
  const leidos = Number(caso.bytesLeidos);
  const pct = total > 0 ? Math.min(100, (leidos / total) * 100) : 0;
  const sinSenal = estado === "ESCANEANDO" && (!caso.ultimaSenalAt || Date.now() - caso.ultimaSenalAt.getTime() > MINUTOS_SIN_SENAL * 60_000);
  const vigente = !caso.tokenHash && caso.codigoVenceAt > new Date();
  const totalArchivos = porTipo.reduce((s, t) => s + t._count._all, 0);
  const paginas = Math.max(1, Math.ceil(totalFiltrado / POR_PAGINA));
  const base = appUrl();
  const enlace = (t: string | null, p = 1) => {
    const q = new URLSearchParams();
    if (t) q.set("tipo", t);
    if (p > 1) q.set("pagina", String(p));
    const s = q.toString();
    return `${RECUPERACION_PANEL_ROUTE}/${caso.id}${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      {estado === "ESPERANDO" || estado === "ESCANEANDO" ? <RefrescoAutomatico segundos={estado === "ESPERANDO" ? 5 : 4} /> : null}
      <p className="text-sm">
        <Link href={RECUPERACION_PANEL_ROUTE} className="text-[var(--fo-muted)] hover:underline">← Recuperación de tarjetas</Link>
      </p>
      <PageHeader title={caso.titulo} description={caso.notas ?? undefined} />

      {estado === "ESPERANDO" ? (
        vigente ? (
          <InstruccionesPrograma codigo={codigoLegible(caso.codigo)} comandoMac={comandoMac(base, caso.codigo)} descargaWindows={`${base}/api/recuperacion/programa/windows`} />
        ) : (
          <section className="fo-card p-5 text-sm">
            {caso.tokenHash ? "El programa ya se conectó. En unos segundos empieza a mostrar el avance." : "El código de este caso venció. Abrí un caso nuevo para obtener otro."}
          </section>
        )
      ) : (
        <section className="fo-card space-y-3 p-5" aria-labelledby="rec-avance">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="rec-avance" className="text-base font-semibold">{ETIQUETA_ESTADO[estado] ?? estado}</h2>
            <span className="text-sm text-[var(--fo-muted)]">
              {[caso.dispositivo, caso.equipo].filter(Boolean).join(" · ")}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[var(--fo-border)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <div className="h-full rounded-full bg-[var(--fo-accent,#2563eb)] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm">
            {pct.toFixed(1).replace(".", ",")} % · {bytesLegibles(leidos)} de {bytesLegibles(total)} leídos · <strong>{caso.encontrados.toLocaleString("es-AR")}</strong> archivos encontrados
          </p>
          {sinSenal ? <p role="alert" className="text-sm text-[var(--fo-danger,#b00020)]">Hace más de {MINUTOS_SIN_SENAL} minutos que el programa no da señales. Puede que la computadora se haya suspendido o perdido internet; lo recuperado igual queda guardado en ella.</p> : null}
          {Number(caso.sectoresMalos) > 0 ? <p className="text-sm text-[var(--fo-danger,#b00020)]">{Number(caso.sectoresMalos).toLocaleString("es-AR")} sectores no se pudieron leer: la tarjeta puede estar dañada. Conviene no volver a usarla.</p> : null}
          {caso.mensaje ? <p className="text-sm text-[var(--fo-muted)]">{caso.mensaje}</p> : null}
          {estado === "TERMINADO" ? <p className="text-sm text-[var(--fo-muted)]">Los archivos completos quedaron en la computadora donde corrió el programa, en la carpeta «FOTOFFICE Recuperadas».</p> : null}
        </section>
      )}

      {totalArchivos > 0 ? (
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="fo-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Por tipo</h3>
            <ul className="space-y-1 text-sm">
              {porTipo.map((t) => (
                <li key={t.tipo} className="flex justify-between gap-2">
                  <span>{ETIQUETA_TIPO[t.tipo as TipoArchivoRecuperado] ?? t.tipo}</span>
                  <span className="text-[var(--fo-muted)]">{t._count._all.toLocaleString("es-AR")} · {bytesLegibles(Number(t._sum.tamanio ?? 0))}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="fo-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Cámaras</h3>
            {porCamara.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">Sin datos de cámara.</p> : (
              <ul className="space-y-1 text-sm">
                {porCamara.map((c) => (
                  <li key={c.camara ?? ""} className="flex justify-between gap-2"><span className="truncate">{c.camara}</span><span className="text-[var(--fo-muted)]">{c._count._all.toLocaleString("es-AR")}</span></li>
                ))}
              </ul>
            )}
          </div>
          <div className="fo-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Días con más fotos</h3>
            {diasOrdenados.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">Sin fechas de toma.</p> : (
              <ul className="space-y-1 text-sm">
                {diasOrdenados.map(([d, n]) => (
                  <li key={d} className="flex justify-between gap-2"><span>{diaLegible(d)}</span><span className="text-[var(--fo-muted)]">{n.toLocaleString("es-AR")}</span></li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {totalArchivos > 0 ? (
        <section className="fo-card space-y-4 p-5" aria-labelledby="rec-archivos">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="rec-archivos" className="mr-2 text-base font-semibold">Archivos</h2>
            <Link href={enlace(null)} className={`fo-btn ${tipo ? "fo-btn-secondary" : "fo-btn-primary"}`}>Todos</Link>
            {porTipo.map((t) => (
              <Link key={t.tipo} href={enlace(t.tipo)} className={`fo-btn ${tipo === t.tipo ? "fo-btn-primary" : "fo-btn-secondary"}`}>
                {ETIQUETA_TIPO[t.tipo as TipoArchivoRecuperado] ?? t.tipo}
              </Link>
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {archivos.map((a) => (
              <li key={a.id} className="space-y-1">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-[var(--fo-border)]">
                  {miniaturas[a.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- enlace firmado del bucket privado, vence en horas
                    <img src={miniaturas[a.id]} alt={a.nombreLocal} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="px-2 text-center text-xs text-[var(--fo-muted)]">{a.tipo === "VIDEO" ? "Video" : "Sin vista previa"} · {a.extension.toUpperCase()}</span>
                  )}
                </div>
                <p className="truncate text-xs font-medium" title={a.nombreLocal}>{a.nombreLocal}</p>
                <p className="truncate text-xs text-[var(--fo-muted)]">
                  {[fechaTomaLegible(a.fechaToma), a.ancho && a.alto ? `${a.ancho}×${a.alto}` : null, bytesLegibles(Number(a.tamanio))].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
          {paginas > 1 ? (
            <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Páginas">
              {pagina > 1 ? <Link className="fo-btn fo-btn-secondary" href={enlace(tipo, pagina - 1)}>Anterior</Link> : null}
              <span className="text-[var(--fo-muted)]">Página {pagina} de {paginas}</span>
              {pagina < paginas ? <Link className="fo-btn fo-btn-secondary" href={enlace(tipo, pagina + 1)}>Siguiente</Link> : null}
            </nav>
          ) : null}
        </section>
      ) : null}

      {hasLevel(nivel, "MANAGE") ? <BorrarCaso id={caso.id} /> : null}
    </div>
  );
}

/** Para el resumen por día alcanza con una muestra grande; no hace falta traer 60.000 filas. */
const MAX_FECHAS = 20_000;
