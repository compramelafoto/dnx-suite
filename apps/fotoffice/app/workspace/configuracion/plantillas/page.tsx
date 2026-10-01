import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { listarCampos } from "@/lib/campos/definiciones";
import { tiposConModuloEncendido } from "@/lib/campos/modulos";
import { MAX_PLANTILLAS_ACTIVAS_POR_CANAL, type Canal, type TipoPlantilla } from "@/lib/plantillas/constantes";
import { asegurarPlantillasIniciales } from "@/lib/plantillas/semillas";
import {
  AUTOMATICOS,
  contarUsosPorPlantilla,
  leerAutomatico,
  listarPlantillas,
} from "@/lib/plantillas/definiciones";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { prisma } from "@repo/db";
import { AutomaticoForm } from "./automatico-form";
import type { CamposPorTipo, OpcionTipo } from "./editor-texto";
import { PlantillasLista, type PlantillaFila } from "./plantillas-lista";

export const dynamic = "force-dynamic";

type Pestana = { slug: "correo" | "whatsapp" | "automaticos"; titulo: string; canal: Canal | null };

const PESTANAS: Pestana[] = [
  { slug: "correo", titulo: "Correo", canal: "EMAIL" },
  { slug: "whatsapp", titulo: "WhatsApp", canal: "WHATSAPP" },
  { slug: "automaticos", titulo: "Automáticos", canal: null },
];

export default async function ConfiguracionPlantillasPage({
  searchParams,
}: {
  searchParams: Promise<{ canal?: string }>;
}) {
  const { workspace, role } = await requireActiveWorkspaceRole();

  // El permiso va antes que cualquier lectura de plantillas.
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Plantillas" />
        <p className="text-sm text-[var(--fo-muted)]">
          Sólo el dueño o un administrador pueden cambiar las plantillas de mensajes.
        </p>
      </div>
    );
  }

  // La primera vez se crean la respuesta automática (apagada) y, en DNX, sus plantillas.
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: workspace.id },
    select: { publicSlug: true },
  });
  await asegurarPlantillasIniciales(workspace.id, branding?.publicSlug ?? "");

  const [vocabulario, encendidos] = await Promise.all([
    loadPersonVocabulary(workspace.id),
    tiposConModuloEncendido(workspace.id),
  ]);
  const etiquetas: Record<TipoPlantilla, string> = {
    GENERAL: "General",
    CLIENTE: "Clientes",
    SOCIO: vocabulario.Plural,
    CONSULTA: "Consultas",
  };
  // GENERAL siempre; Clientes, Socios y Consultas sólo con su módulo encendido.
  const tipos: OpcionTipo[] = [
    { valor: "GENERAL", etiqueta: etiquetas.GENERAL },
    ...encendidos.map((t) => ({ valor: t, etiqueta: etiquetas[t] })),
  ];
  const conCaptacion = encendidos.includes("CONSULTA");

  const pestanas = PESTANAS.filter((p) => p.slug !== "automaticos" || conCaptacion);
  const { canal: pedido } = await searchParams;
  const elegida = pestanas.find((p) => p.slug === pedido) ?? pestanas[0]!;

  // Campos personalizados activos de cada tipo encendido, para la lista de variables.
  const campos: CamposPorTipo = { GENERAL: [], CLIENTE: [], SOCIO: [], CONSULTA: [] };
  const listas = await Promise.all(encendidos.map((t) => listarCampos(workspace.id, t)));
  encendidos.forEach((t, i) => {
    campos[t] = listas[i]!.map((c) => ({ clave: c.key, nombre: c.name }));
  });

  let contenido: React.ReactNode;
  if (elegida.canal) {
    const definidas = await listarPlantillas(workspace.id, { canal: elegida.canal, incluirArchivadas: true });
    const usos = await contarUsosPorPlantilla(workspace.id, definidas.map((p) => p.id));
    const filas: PlantillaFila[] = definidas.map((p) => ({
      id: p.id,
      name: p.name,
      entityType: p.entityType,
      subject: p.subject,
      body: p.body,
      archivado: p.archivedAt !== null,
      usos: usos[p.id] ?? 0,
      actualizada: p.updatedAt.toISOString(),
    }));
    contenido = (
      <PlantillasLista
        key={elegida.canal}
        canal={elegida.canal}
        plantillas={filas}
        tipos={tipos}
        etiquetas={etiquetas}
        campos={campos}
      />
    );
  } else {
    const def = AUTOMATICOS.CONSULTA_AUTORESPUESTA;
    const auto = await leerAutomatico(workspace.id, "CONSULTA_AUTORESPUESTA");
    contenido = (
      <AutomaticoForm
        clave="CONSULTA_AUTORESPUESTA"
        nombre={def.nombre}
        canal={def.canal}
        tipo={def.tipo}
        encendido={auto?.enabled ?? false}
        actualizado={auto?.updatedAt.toISOString() ?? ""}
        asunto={auto?.subject ?? ""}
        cuerpo={auto?.body ?? ""}
        campos={campos[def.tipo]}
      />
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Plantillas"
        description={`Textos listos para mandar por correo o WhatsApp desde las fichas. Hasta ${MAX_PLANTILLAS_ACTIVAS_POR_CANAL} plantillas activas por canal.`}
      />
      <nav aria-label="Canal" className="flex flex-wrap gap-2 border-b border-[var(--fo-border)] pb-2">
        {pestanas.map((p) => {
          const activa = p.slug === elegida.slug;
          return (
            <Link
              key={p.slug}
              href={`/workspace/configuracion/plantillas?canal=${p.slug}`}
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
