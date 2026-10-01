import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { asegurarCamposIniciales } from "@/lib/campos/semillas";
import { contarValoresPorCampo, leerCampos } from "@/lib/campos/definiciones";
import { MAX_CAMPOS, type TipoRegistroActivo } from "@/lib/campos/constantes";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { prisma } from "@repo/db";
import { CamposLista, type CampoFila } from "./campos-lista";

export const dynamic = "force-dynamic";

const PESTANAS: { slug: string; entityType: TipoRegistroActivo }[] = [
  { slug: "clientes", entityType: "CLIENTE" },
  { slug: "socios", entityType: "SOCIO" },
  { slug: "consultas", entityType: "CONSULTA" },
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

  const [vocabulario, conCaptacion] = await Promise.all([
    loadPersonVocabulary(workspace.id),
    isModuleEnabledForWorkspace(workspace.id, SERVICE_LEADS_MODULE_KEY),
  ]);
  const titulos: Record<TipoRegistroActivo, string> = {
    CLIENTE: "Clientes",
    SOCIO: vocabulario.Plural,
    CONSULTA: "Consultas",
  };
  // Consultas sólo con Captación encendida.
  const pestanas = PESTANAS.filter((p) => p.entityType !== "CONSULTA" || conCaptacion);

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
        description={`Datos propios que querés guardar en cada ficha de clientes, ${vocabulario.plural}${conCaptacion ? " o consultas" : ""}. Hasta ${MAX_CAMPOS} campos activos por tipo.`}
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
