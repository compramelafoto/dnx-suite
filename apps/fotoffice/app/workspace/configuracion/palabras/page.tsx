import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { requireOwnWorkspace } from "@/lib/entrada/require-own-workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { frasesDeEjemplo } from "@/lib/vocabulario/ejemplos";
import { PalabrasForm } from "./palabras-form";

export const dynamic = "force-dynamic";

/**
 * Cómo llama esta institución a la gente de su padrón.
 *
 * El módulo se escribió para la SFPR, que tiene socios de verdad; Foto Positiva tiene
 * voluntarios y una escuela tendría alumnos. Hasta que existió esta pantalla, cambiar la
 * palabra pedía escribir una fila en la base a mano: la función estaba entera pero no se
 * podía usar.
 *
 * Se leen las palabras **crudas** de la tabla, no `loadPersonVocabulary`: ese cargador ya
 * resuelve el vacío a "socio/socios", y el formulario necesita distinguir "no configuró
 * nada" de "configuró justo la palabra por omisión". Si no, los campos aparecerían llenos
 * con socio/socios para todo el mundo y guardar crearía una fila que nadie pidió.
 *
 * Ver la vecindad: esto es una subpantalla de Configuración, como Cobros e Integraciones, y
 * usa su mismo permiso (`canManageWorkspaceSettings`). No se mezcla con la terminología del
 * módulo de Coberturas (`/coberturas/configuracion`): esa nombra las cosas de ese módulo
 * —solicitud, colaborador, convocatoria— y esta nombra a las personas del padrón. Son dos
 * ejes distintos y conviven.
 */
export default async function PalabrasPage() {
  const user = await requireAuth();
  const ensured = await requireOwnWorkspace(user);

  const [membership, fila] = await Promise.all([
    prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: ensured.workspaceId } },
      select: { role: true },
    }),
    prisma.workspaceVocabulary.findUnique({
      where: { workspaceId: ensured.workspaceId },
      select: { personSingular: true, personPlural: true },
    }),
  ]);
  const canEdit = canManageWorkspaceSettings(membership?.role);

  return (
    <div className="max-w-xl space-y-8">
      <PageHeader
        title="Las palabras de tu institución"
        description="Cómo le decís a la gente de tu padrón. Lo que elijas acá se lee en el menú, en las pantallas del módulo y en el portal de cada persona."
      />

      {!canEdit ? (
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]" role="status">
          Tenés acceso de solo lectura a esta pantalla.
        </p>
      ) : null}

      <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
        Cambiar la palabra no reescribe lo que ya está escrito: las notas, los motivos de baja
        y los correos que ya salieron quedan como estaban. De acá en adelante, el sistema habla
        como hablás vos.
      </p>

      <PalabrasForm
        canEdit={canEdit}
        ejemplos={frasesDeEjemplo()}
        initial={{
          singular: fila?.personSingular ?? "",
          plural: fila?.personPlural ?? "",
        }}
      />
    </div>
  );
}
