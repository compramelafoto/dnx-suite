import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { portfolioDeCategoria } from "@/lib/presupuesto-automatico/ajustes";
import { fotosDelPortfolio, galeriasParaElegir } from "@/lib/presupuesto-automatico/portfolio";
import { MAX_FOTOS_POR_GALERIA, type ItemPortfolio } from "@/lib/presupuesto-automatico/portfolio-items";
import { AgregarGaleriaForm, CambioBoton, SubirFotoForm } from "./portfolio-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ categoriaId: string }>; searchParams: Promise<{ galeria?: string }> };

/**
 * Configuración → Telegram → Portfolio de una categoría (spec 2026-10-25): lo que ve el cliente
 * arriba de su presupuesto. Galerías enteras o fotos sueltas de Galería, o fotos subidas a
 * propósito. Permiso: `configurar`, antes de cualquier lectura.
 */
export default async function PortfolioCategoriaPage({ params, searchParams }: Props) {
  const { workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Portfolio" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar el portfolio.</p>
      </div>
    );
  }
  const { categoriaId } = await params;
  const { galeria: galeriaElegida } = await searchParams;
  const categoria = await prisma.fotofficeConsultaCategoria.findFirst({ where: { id: categoriaId, workspaceId: workspace.id }, select: { id: true, name: true } });
  if (!categoria) notFound();

  const [items, galerias] = await Promise.all([portfolioDeCategoria(workspace.id, categoria.id), galeriasParaElegir(workspace.id)]);
  const vistas = await Promise.all(items.map((i) => vistaDe(workspace.id, i, galerias)));
  const elegida = galeriaElegida ? galerias.find((g) => g.id === galeriaElegida) ?? null : null;
  const fotosElegida = elegida
    ? await fotosDelPortfolio(workspace.id, [{ tipo: "GALERIA", galeriaId: elegida.id, cantidad: MAX_FOTOS_POR_GALERIA }])
    : [];
  const yaEstan = new Set(items.filter((i): i is Extract<ItemPortfolio, { tipo: "FOTO" }> => i.tipo === "FOTO").map((i) => i.fotoId));
  const ruta = `/workspace/configuracion/telegram/portfolio/${encodeURIComponent(categoria.id)}`;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={`Portfolio · ${categoria.name}`} description="Las fotos que ve el cliente en la página de su presupuesto, antes del detalle. Elegí trabajos de este tipo de evento." />
      <p className="text-sm">
        <Link href="/workspace/configuracion/telegram" className="text-[var(--fo-accent)] hover:underline">← Volver a Telegram</Link>
      </p>

      <section className="fo-card space-y-3 p-5 text-sm" aria-labelledby="pf-actual">
        <h2 id="pf-actual" className="text-base font-semibold">Lo que ve el cliente (en este orden)</h2>
        {vistas.length === 0 ? (
          <p className="text-[var(--fo-muted)]">Todavía no hay nada. Agregá una galería o subí fotos: sin portfolio, la página muestra sólo el presupuesto.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)]">
            {vistas.map((v, i) => (
              <li key={`${i}-${v.titulo}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  {v.miniatura ? (
                    // Enlace firmado que vence: no pasa por el optimizador de imágenes.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.miniatura} alt="" width={56} height={56} loading="lazy" className="h-14 w-14 rounded object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded bg-[var(--fo-bg-elevated)] text-xs text-[var(--fo-muted)]">sin foto</span>
                  )}
                  <div>
                    <p className="font-medium">{v.titulo}</p>
                    <p className="text-xs text-[var(--fo-muted)]">{v.detalle}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {i > 0 ? <CambioBoton categoriaId={categoria.id} campos={{ accion: "subir", indice: String(i) }} texto="↑" etiqueta={`Subir ${v.titulo}`} /> : null}
                  {i < vistas.length - 1 ? <CambioBoton categoriaId={categoria.id} campos={{ accion: "bajar", indice: String(i) }} texto="↓" etiqueta={`Bajar ${v.titulo}`} /> : null}
                  <CambioBoton categoriaId={categoria.id} campos={{ accion: "quitar", indice: String(i) }} texto="Quitar" etiqueta={`Quitar ${v.titulo}`} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="fo-card space-y-3 p-5 text-sm" aria-labelledby="pf-galeria">
        <h2 id="pf-galeria" className="text-base font-semibold">Agregar desde Galería</h2>
        {galerias.length === 0 ? (
          <p className="text-[var(--fo-muted)]">No hay galerías con fotos listas.</p>
        ) : (
          <>
            <AgregarGaleriaForm categoriaId={categoria.id} galerias={galerias.map((g) => ({ id: g.id, etiqueta: `${g.nombre} · N° ${g.numero} (${g.fotos} fotos)` }))} />
            <p className="text-[var(--fo-muted)]">O elegí fotos sueltas de una galería:</p>
            <ul className="flex flex-wrap gap-2">
              {galerias.slice(0, 30).map((g) => (
                <li key={g.id}>
                  <Link href={`${ruta}?galeria=${encodeURIComponent(g.id)}`} className={`fo-btn text-xs ${elegida?.id === g.id ? "fo-btn-primary" : "fo-btn-secondary"}`}>
                    {g.nombre}
                  </Link>
                </li>
              ))}
            </ul>
            {elegida ? (
              fotosElegida.length === 0 ? (
                <p className="text-[var(--fo-muted)]">Esa galería no tiene fotos para mostrar.</p>
              ) : (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {fotosElegida.map((f) => (
                    <li key={f.id} className="space-y-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.miniatura} alt="" loading="lazy" className="aspect-square w-full rounded object-cover" />
                      {yaEstan.has(f.id) ? (
                        <p className="text-xs text-[var(--fo-success)]">Ya está</p>
                      ) : (
                        <CambioBoton categoriaId={categoria.id} campos={{ accion: "foto", galeriaId: elegida.id, fotoId: f.id }} texto="Agregar" etiqueta="Agregar esta foto" />
                      )}
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </>
        )}
      </section>

      <section className="fo-card space-y-3 p-5 text-sm" aria-labelledby="pf-subir">
        <h2 id="pf-subir" className="text-base font-semibold">Subir una foto</h2>
        <SubirFotoForm categoriaId={categoria.id} />
      </section>
    </div>
  );
}

type Vista = { titulo: string; detalle: string; miniatura: string | null };

async function vistaDe(workspaceId: string, i: ItemPortfolio, galerias: { id: string; nombre: string; numero: string }[]): Promise<Vista> {
  const fotos = await fotosDelPortfolio(workspaceId, [i.tipo === "GALERIA" ? { ...i, cantidad: 1 } : i]);
  const miniatura = fotos[0]?.miniatura ?? null;
  if (i.tipo === "SUBIDA") return { titulo: "Foto subida", detalle: "Subida a propósito para este portfolio", miniatura };
  const g = galerias.find((x) => x.id === i.galeriaId);
  const nombre = g ? `${g.nombre} · N° ${g.numero}` : "Galería archivada o sin fotos (no se muestra)";
  if (i.tipo === "GALERIA") return { titulo: `Galería ${nombre}`, detalle: `Sus primeras ${i.cantidad} fotos`, miniatura };
  return { titulo: "Foto suelta", detalle: `De ${nombre}`, miniatura };
}
