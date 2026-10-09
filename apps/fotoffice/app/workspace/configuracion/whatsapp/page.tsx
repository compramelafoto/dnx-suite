import Link from "next/link";
import { headers } from "next/headers";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { appUrl } from "@/lib/app-url";
import { estadoConexion, leerConexion } from "@/lib/bandeja/conexion";
import { BANDEJA_MODULE_KEY } from "@/lib/bandeja/constantes";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { ConexionForm, SimuladorForm } from "./whatsapp-form";

export const dynamic = "force-dynamic";

/**
 * Configuración → WhatsApp: estado de la conexión, horas de pausa del bot, datos para Meta y el
 * simulador. Permiso: `configurar`. Se puede configurar con el módulo apagado; sólo cambia el aviso.
 * El token NUNCA se lee hacia la pantalla: `estadoConexion` sólo dice si hay uno.
 */
export default async function ConfiguracionWhatsappPage() {
  const { workspace, role } = await requireActiveWorkspaceRole();

  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="WhatsApp" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar WhatsApp.</p>
      </div>
    );
  }

  const [conexion, estado, encendido, cabeceras] = await Promise.all([
    leerConexion(workspace.id),
    estadoConexion(workspace.id),
    isModuleEnabledForWorkspace(workspace.id, BANDEJA_MODULE_KEY),
    headers(),
  ]);
  const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host");
  const origen = appUrl() || (host ? `${cabeceras.get("x-forwarded-proto") ?? "https"}://${host}` : "");
  const urlWebhook = `${origen}/api/webhooks/whatsapp`;
  const real = conexion.modo === "REAL";

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="WhatsApp" description="Conexión de la Bandeja de WhatsApp, pausa del bot y simulador de mensajes." />
      {!encendido ? (
        <div role="status" className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          El módulo Bandeja de WhatsApp todavía no está encendido. Podés dejar la conexión lista; para encenderlo, pedilo desde{" "}
          <Link href="/workspace/configuracion/modulos" className="text-[var(--fo-accent)] hover:underline">Configuración → Módulos</Link>.
        </div>
      ) : null}
      <section className="fo-card space-y-1 p-5 text-sm" aria-labelledby="wa-estado-titulo">
        <h2 id="wa-estado-titulo" className="text-base font-semibold">Estado</h2>
        <p>
          {real ? "Conectado a WhatsApp" : "Modo de prueba (los mensajes no salen)"}
          {real && conexion.displayPhone ? ` · ${conexion.displayPhone}` : ""}
        </p>
        <p className={estado.tieneToken ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}>{estado.tieneToken ? "Token cargado" : "Falta el token"}</p>
      </section>
      <ConexionForm
        conexion={{
          modo: conexion.modo,
          phoneNumberId: conexion.phoneNumberId ?? "",
          wabaId: conexion.wabaId ?? "",
          displayPhone: conexion.displayPhone ?? "",
          pausaBotHoras: conexion.pausaBotHoras,
        }}
        tieneToken={estado.tieneToken}
      />
      <section className="fo-card space-y-2 p-5 text-sm" aria-labelledby="wa-meta-titulo">
        <h2 id="wa-meta-titulo" className="text-base font-semibold">Datos para Meta</h2>
        <p className="text-[var(--fo-muted)]">En el panel de Meta, en Webhooks, pegá esta dirección:</p>
        <p><code className="break-all">{urlWebhook}</code></p>
        <p className="text-[var(--fo-muted)]">
          El token de verificación y el secreto de la app son variables de entorno que carga la plataforma; acá no se ven ni se editan.
        </p>
        <ul className="text-[var(--fo-muted)]">
          <li>Token de verificación (WHATSAPP_WEBHOOK_VERIFY_TOKEN): {process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? "configurado" : "falta"}</li>
          <li>Secreto de la app (WHATSAPP_APP_SECRET): {process.env.WHATSAPP_APP_SECRET ? "configurado" : "falta"}</li>
        </ul>
      </section>
      {!encendido ? (
        <p className="text-sm text-[var(--fo-muted)]">El simulador de mensajes aparece cuando se enciende el módulo Bandeja de WhatsApp.</p>
      ) : real ? null : <SimuladorForm />}
    </div>
  );
}
