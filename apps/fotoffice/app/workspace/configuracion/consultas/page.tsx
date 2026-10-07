import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { asegurarCatalogosIniciales } from "@/lib/consultas/semillas";
import { listarCategorias } from "@/lib/consultas/categorias";
import { listarOrigenes } from "@/lib/consultas/origenes";
import { listarRoles } from "@/lib/consultas/participantes";
import { leerAjustes } from "@/lib/consultas/ajustes";
import { responsablesDeConsultas } from "@/lib/consultas/ficha";
import { formulariosConCategoriaReemplazada } from "@/lib/consultas/configuracion";
import type { ItemCatalogo } from "@/lib/consultas/catalogo";
import { prisma } from "@repo/db";
import { CatalogoLista, type ItemFila } from "./catalogo-lista";
import { AvisosForm } from "./avisos-form";

export const dynamic = "force-dynamic";

const PESTANAS = [
  { slug: "categorias", titulo: "Categorías" },
  { slug: "origenes", titulo: "Orígenes" },
  { slug: "roles", titulo: "Roles de participante" },
  { slug: "avisos", titulo: "Avisos" },
] as const;
type Pestana = (typeof PESTANAS)[number]["slug"];

function aFila(i: ItemCatalogo): ItemFila {
  return { id: i.id, name: i.name, archivado: i.archivedAt !== null, usos: i.usos, grupo: i.group ?? null };
}

export default async function ConfiguracionConsultasPage({
  searchParams,
}: {
  searchParams: Promise<{ pestana?: string }>;
}) {
  const { workspace, role } = await requireActiveWorkspaceRole();

  // El permiso va antes que cualquier lectura.
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Consultas" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar las consultas.</p>
      </div>
    );
  }
  if (!(await isModuleEnabledForWorkspace(workspace.id, SERVICE_LEADS_MODULE_KEY))) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Consultas" />
        <p className="text-sm text-[var(--fo-muted)]">
          El módulo Consultas está apagado. Encendelo en{" "}
          <Link href="/workspace/configuracion/modulos" className="text-[var(--fo-accent)] hover:underline">
            Configuración → Módulos
          </Link>{" "}
          para configurarlo.
        </p>
      </div>
    );
  }

  // Los catálogos iniciales (DNX: 21 categorías, 8 orígenes y 16 roles; el resto, los 9 tipos).
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: workspace.id },
    select: { publicSlug: true },
  });
  await asegurarCatalogosIniciales(workspace.id, branding?.publicSlug ?? "");

  const { pestana: pedida } = await searchParams;
  const elegida: Pestana = PESTANAS.find((p) => p.slug === pedida)?.slug ?? "categorias";

  let contenido: React.ReactNode;
  if (elegida === "categorias") {
    const [categorias, reemplazados] = await Promise.all([
      listarCategorias(workspace.id, { incluirArchivados: true }),
      formulariosConCategoriaReemplazada(workspace.id),
    ]);
    contenido = (
      <div className="space-y-4">
        {reemplazados.length > 0 ? (
          <div role="status" className="fo-card space-y-2 border-[var(--fo-warning)] p-4 text-sm">
            <p className="font-medium">Categoría reemplazada en formularios públicos</p>
            <ul className="list-disc space-y-1 pl-5 text-[var(--fo-muted)]">
              {reemplazados.map((f) => (
                <li key={f.formularioId}>
                  La categoría de «{f.formulario}» está archivada:{" "}
                  {f.categoria ? <>sus consultas entran en «{f.categoria}».</> : <>no hay ninguna categoría activa para sus consultas.</>}
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--fo-muted)]">Desarchivá la categoría si querés que vuelvan a entrar en la suya.</p>
          </div>
        ) : null}
        <CatalogoLista
          catalogo="categorias"
          titulo="Categorías"
          explicacion="Cada consulta tiene una categoría; el grupo decide qué datos del evento se piden. Una categoría con consultas no se borra: se archiva, y su grupo ya no cambia."
          items={categorias.map(aFila)}
        />
      </div>
    );
  } else if (elegida === "origenes") {
    const origenes = await listarOrigenes(workspace.id, { incluirArchivados: true });
    contenido = (
      <CatalogoLista
        catalogo="origenes"
        titulo="Orígenes"
        explicacion="Las respuestas a «¿Cómo nos conociste?». Un origen ya usado no se borra: se archiva."
        items={origenes.map(aFila)}
      />
    );
  } else if (elegida === "roles") {
    const roles = await listarRoles(workspace.id, { incluirArchivados: true });
    contenido = (
      <CatalogoLista
        catalogo="roles"
        titulo="Roles de participante"
        explicacion="El papel de cada persona que participa de una consulta (padrino, organizadora, salón…). Un rol ya usado no se borra: se archiva."
        items={roles.map(aFila)}
      />
    );
  } else {
    const [ajustes, responsables] = await Promise.all([leerAjustes(workspace.id), responsablesDeConsultas(workspace.id)]);
    contenido = <AvisosForm ajustes={ajustes} responsables={responsables} />;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Consultas" description="Categorías, orígenes, roles de participante y avisos de las consultas nuevas." />
      <nav aria-label="Secciones de Consultas" className="flex flex-wrap gap-2 border-b border-[var(--fo-border)] pb-2">
        {PESTANAS.map((p) => {
          const activa = p.slug === elegida;
          return (
            <Link
              key={p.slug}
              href={`/workspace/configuracion/consultas?pestana=${p.slug}`}
              aria-current={activa ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                activa
                  ? "bg-[var(--fo-surface)] text-[var(--fo-text)] border border-[var(--fo-border)]"
                  : "text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
              }`}
            >
              {p.titulo}
            </Link>
          );
        })}
      </nav>
      {contenido}
    </div>
  );
}
