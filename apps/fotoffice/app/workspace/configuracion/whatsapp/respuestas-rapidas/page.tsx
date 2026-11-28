import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { resolverAcceso } from "@/lib/access/acceso";
import { puede } from "@/lib/access/policy";
import { listarRespuestas } from "@/lib/bandeja/respuestas-rapidas";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { EditorRespuestas } from "./editor";

export const dynamic = "force-dynamic";

/** Configuración → WhatsApp → Respuestas rápidas. Permiso: `configurar` (dueño o administrador). */
export default async function RespuestasRapidasPage() {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  const acceso = await resolverAcceso(user.id, workspace.id);
  const volver = (
    <Link href="/workspace/configuracion/whatsapp" className="text-sm text-[var(--fo-accent-hover)] underline">
      ← Volver a WhatsApp
    </Link>
  );
  if (!puede(acceso, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        {volver}
        <PageHeader title="Respuestas rápidas" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden cambiar las respuestas rápidas.</p>
      </div>
    );
  }
  const respuestas = (await listarRespuestas({ workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role, acceso })) ?? [];
  return (
    <div className="max-w-3xl space-y-6">
      {volver}
      <PageHeader title="Respuestas rápidas" description="Textos guardados para la Bandeja. En la caja de respuesta se insertan escribiendo «/» o con el botón ⚡, y se pueden retocar antes de enviar." />
      <EditorRespuestas respuestas={respuestas} />
    </div>
  );
}
