import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireSalesAssistantManager } from "@/lib/sales-assistant/access";
import { crearClienteAlboom } from "@/lib/sales-assistant/alboom/client";
import { leerCredencialAlboom, resumenConexionAlboom } from "@/lib/sales-assistant/alboom/credentials";
import { fechaHoraVenta } from "@/lib/sales-assistant/format";
import { leerAjustes } from "@/lib/sales-assistant/repository";
import { AjustesForm } from "./ajustes-form";
import { ConexionForm } from "./conexion-form";

export const dynamic = "force-dynamic";

/**
 * Los embudos para elegir: los que devuelve Alboom hoy, más los que ya estaban elegidos aunque
 * Alboom ya no los liste (si no, no habría forma de desmarcarlos).
 *
 * Si Alboom no contesta, se muestran sólo los guardados con un aviso: la pantalla no puede
 * quedarse en blanco porque el CRM está caído.
 */
async function embudosParaElegir(
  workspaceId: string,
  conectado: boolean,
  guardados: string[],
): Promise<{ nombres: string[]; aviso: string | null }> {
  if (!conectado) {
    return {
      nombres: guardados,
      aviso: guardados.length > 0 ? null : "Conectá Alboom para ver tus embudos.",
    };
  }
  try {
    const cred = await leerCredencialAlboom(workspaceId);
    if (!cred) throw new Error("sin credencial");
    const deAlboom = (await (await crearClienteAlboom(cred)).embudos()).map((e) => e.trim()).filter(Boolean);
    return { nombres: [...new Set([...deAlboom, ...guardados])], aviso: null };
  } catch {
    return {
      nombres: guardados,
      aviso: "No pudimos leer los embudos de Alboom ahora. Te mostramos los que ya tenías elegidos.",
    };
  }
}

export default async function ConfiguracionVentasPage() {
  const { workspace } = await requireSalesAssistantManager();
  const [conexion, ajustes] = await Promise.all([
    resumenConexionAlboom(workspace.id),
    leerAjustes(workspace.id),
  ]);
  const embudos = await embudosParaElegir(
    workspace.id,
    conexion?.estado === "ACTIVE",
    ajustes.pipelinesIncluded,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración del asistente"
        description="La conexión con tu CRM, qué embudos mirar y cómo escribís vos."
        actions={
          <Link href="/ventas" className="fo-btn fo-btn-secondary min-h-11">
            Volver a la bandeja
          </Link>
        }
      />

      <section className="fo-card space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Conexión con Alboom</h2>
          <p className="fo-helper">
            El asistente sólo lee: nunca escribe ni cambia nada en Alboom.
          </p>
        </div>

        {conexion?.estado === "NEEDS_RECONSENT" ? (
          <p
            role="alert"
            className="fo-alert-error rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed text-[var(--fo-danger)]"
          >
            Alboom rechazó el usuario. Volvé a escribir la contraseña y guardá para reconectar.
          </p>
        ) : null}

        {conexion ? (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <Dato label="Usuario" valor={conexion.usuario} />
            <Dato label="Subdominio" valor={conexion.subdomain ?? "—"} />
            <Dato
              label="Estado"
              valor={
                conexion.estado === "ACTIVE"
                  ? `Conectada desde el ${fechaHoraVenta(conexion.conectadaEn)}`
                  : conexion.estado === "NEEDS_RECONSENT"
                    ? "Rechazada por Alboom"
                    : "Desconectada"
              }
            />
          </dl>
        ) : (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no conectaste Alboom.</p>
        )}

        <ConexionForm
          subdomain={conexion?.subdomain ?? ""}
          usuario={conexion?.usuario ?? ""}
          hayContrasenia={conexion !== null}
        />
      </section>

      <AjustesForm
        embudos={embudos.nombres}
        avisoEmbudos={embudos.aviso}
        ajustes={{
          pipelinesIncluded: ajustes.pipelinesIncluded,
          signature: ajustes.signature,
          voiceNotes: ajustes.voiceNotes,
          waitDays: ajustes.waitDays,
          staleDays: ajustes.staleDays,
        }}
      />
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs text-[var(--fo-muted)]">{label}</dt>
      <dd className="break-words">{valor}</dd>
    </div>
  );
}
