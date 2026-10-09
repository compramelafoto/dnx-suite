import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { asegurarCamposIniciales } from "@/lib/campos/semillas";
import { contarValoresPorCampo, leerCampos } from "@/lib/campos/definiciones";
import { MAX_CAMPOS, type TipoRegistroActivo } from "@/lib/campos/constantes";
import { enumerar, tiposConModuloEncendido } from "@/lib/campos/modulos";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { prisma } from "@repo/db";
import { CamposLista, type CampoFila } from "./campos-lista";

export const dynamic = "force-dynamic";

const PESTANAS: { slug: string; entityType: TipoRegistroActivo }[] = [
  { slug: "clientes", entityType: "CLIENTE" },
  { slug: "socios", entityType: "SOCIO" },
  { slug: "consultas", entityType: "CONSULTA" },
  { slug: "proyectos", entityType: "PROYECTO" },
];

export default async function ConfiguracionCamposPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { workspace, role } = await requireActiveWorkspaceRole();

  // El permiso va antes que cualquier lectura de campos.
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Campos" />
        <p className="text-sm text-[var(--fo-muted)]">
          Sólo el dueño o un administrador pueden cambiar los campos personalizados.
        </p>
      </div>
    );
  }

  // DNX arranca con "Archivos del cliente"; el resto de los workspaces, sin campos.
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: workspace.id },
    select: { publicSlug: true },
  });
  await asegurarCamposIniciales(workspace.id, branding?.publicSlug ?? "");

  const [vocabulario, encendidos] = await Promise.all([
    loadPersonVocabulary(workspace.id),
    tiposConModuloEncendido(workspace.id),
  ]);
  const titulos: Record<TipoRegistroActivo, string> = {
    CLIENTE: "Clientes",
    SOCIO: vocabulario.Plural,
    CONSULTA: "Consultas",
    PROYECTO: "Proyectos",
  };
  const enMinuscula: Record<TipoRegistroActivo, string> = { CLIENTE: "clientes", SOCIO: vocabulario.plural, CONSULTA: "consultas", PROYECTO: "proyectos" };
  // Cada pestaña sólo con su módulo encendido: Clientes, Socios, Captación.
  const pestanas = PESTANAS.filter((p) => encendidos.includes(p.entityType));
  if (pestanas.length === 0) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Campos" />
        <p className="text-sm text-[var(--fo-muted)]">
          Los campos personalizados se usan en las fichas de clientes, {vocabulario.plural} o consultas. Encendé alguno de
          esos módulos para configurarlos.
        </p>
      </div>
    );
  }

  const { tipo: pedido } = await searchParams;
  const elegida = pestanas.find((p) => p.slug === pedido) ?? pestanas[0]!;

  const definidos = await leerCampos(workspace.id, elegida.entityType, true);
  const valores = await contarValoresPorCampo(workspace.id, definidos.map((c) => c.id));
  const filas: CampoFila[] = definidos.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    required: c.required,
    showInList: c.showInList,
    archivado: c.archivedAt !== null,
    valores: valores[c.id] ?? 0,
    opciones: c.opciones.map((o) => ({ id: o.id, label: o.label })),
  }));

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Campos"
        description={`Datos propios que querés guardar en cada ficha de ${enumerar(pestanas.map((p) => enMinuscula[p.entityType]), "o")}. Hasta ${MAX_CAMPOS} campos activos por tipo.`}
      />
      <nav aria-label="Tipo de registro" className="flex flex-wrap gap-2 border-b border-[var(--fo-border)] pb-2">
        {pestanas.map((p) => {
          const activa = p.slug === elegida.slug;
          return (
            <Link
              key={p.slug}
              href={`/workspace/configuracion/campos?tipo=${p.slug}`}
              aria-current={activa ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                activa
                  ? "bg-[var(--fo-surface)] text-[var(--fo-text)] border border-[var(--fo-border)]"
                  : "text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
              }`}
            >
              {titulos[p.entityType]}
            </Link>
          );
        })}
      </nav>
      <CamposLista
        key={elegida.entityType}
        entityType={elegida.entityType}
        titulo={titulos[elegida.entityType]}
        campos={filas}
      />
    </div>
  );
}
