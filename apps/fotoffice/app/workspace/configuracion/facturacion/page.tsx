import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { diasParaVencer } from "@/lib/invoicing/certificado";
import { ARCA_ENVIRONMENTS, ENVIRONMENT_LABELS, INVOICING_MODULE_KEY, type ArcaEnvironment } from "@/lib/invoicing/constants";
import { leerCredenciales, leerPerfil } from "@/lib/invoicing/servicio";
import { generarCsrAction, guardarPerfilAction, subirCertificadoAction } from "./actions";
import { ProbarConexion } from "./probar-conexion";

export const dynamic = "force-dynamic";

function fechaAR(d: Date): string {
  return d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
}

const PASOS: Record<ArcaEnvironment, { titulo: string; pasos: string[] }> = {
  HOMOLOGACION: {
    titulo: "Pruebas (homologación): facturas que no valen, para probar todo antes",
    pasos: [
      "Acá abajo, tocá «Generar pedido de certificado» y después «Descargar pedido». Es un archivo chiquito que termina en .csr. La clave secreta queda guardada en FOTOFFICE, cifrada: no la tenés que guardar vos.",
      "Entrá a arca.gob.ar con la clave fiscal del titular del CUIT. En «Administrador de Relaciones de Clave Fiscal» → «Adherir servicio» → ARCA → Servicios interactivos, buscá «WSASS - Autogestión Certificados Homologación» y adherilo. Salí y volvé a entrar.",
      "Abrí WSASS. En «Nuevo certificado» poné el mismo nombre que usaste acá (por ejemplo fotofficehomo), abrí el .csr con el Bloc de notas, copiá todo el texto y pegalo. Tocá «Crear DN y obtener certificado».",
      "WSASS te muestra el certificado: copiá todo el texto (desde -----BEGIN CERTIFICATE----- hasta -----END CERTIFICATE-----), pegalo en un archivo y guardalo como certificado.crt (o pegalo directo en el cuadro de acá abajo).",
      "En WSASS, «Crear autorización a servicio»: elegí ese certificado, el CUIT del titular y el servicio «wsfe - Facturación Electrónica». Confirmá.",
      "Volvé acá, subí el certificado y tocá «Probar conexión». Tienen que salir los tres pasos en verde.",
      "Emití una factura de prueba desde una venta. Sale con la marca «sin validez fiscal». Anulala con la nota de crédito para probar ese camino también.",
    ],
  },
  PRODUCCION: {
    titulo: "Producción: las facturas de verdad",
    pasos: [
      "Recién cuando todo funcionó en pruebas. Generá acá un pedido de certificado de producción (es otro, distinto del de pruebas) y descargalo.",
      "En arca.gob.ar, con la clave fiscal del titular, entrá a «Administración de Certificados Digitales» (si no aparece, adherilo desde el Administrador de Relaciones). «Agregar alias»: poné el mismo nombre que usaste acá (por ejemplo fotofficeprod), subí el archivo .csr y descargá el certificado (.crt).",
      "En «Administrador de Relaciones de Clave Fiscal» → «Nueva relación» → «Buscar» → ARCA → Web Services → «Facturación Electrónica». En «Representante» elegí el certificado (el alias) y confirmá.",
      "En «Administración de puntos de venta y domicilios» dá de alta un punto de venta nuevo, sistema «Factura Electrónica - Monotributo - Web Services» (o el de exentos, según corresponda), con tu domicilio. Tiene que ser distinto del que usás para facturar a mano o en la web de ARCA: si no, los números chocan.",
      "Volvé acá: subí el certificado de producción, poné ese número de punto de venta en los datos fiscales, cambiá el ambiente a «Producción» y tocá «Probar conexión».",
    ],
  },
};

export default async function ConfiguracionFacturacionPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { workspace, role } = await requireActiveWorkspaceRole();
  const sp = await searchParams;

  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Facturación electrónica" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar la facturación.</p>
      </div>
    );
  }
  // Con el módulo apagado no se lee ninguna tabla de facturación (puede no existir todavía).
  if (!(await isModuleEnabledForWorkspace(workspace.id, INVOICING_MODULE_KEY))) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Facturación electrónica" />
        <p className="text-sm text-[var(--fo-muted)]">
          El módulo de facturación electrónica está apagado. Encendelo en{" "}
          <Link className="underline" href="/workspace/configuracion/modulos">Módulos</Link> para conectar FOTOFFICE con ARCA.
        </p>
      </div>
    );
  }

  const [perfil, credenciales] = await Promise.all([leerPerfil(workspace.id), leerCredenciales(workspace.id)]);
  const ahora = new Date();

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        title="Facturación electrónica"
        description="Conectá FOTOFFICE con ARCA para emitir Factura C y nota de crédito C desde las ventas y los pedidos. Algunos pasos sólo los puede hacer el titular del CUIT, con su clave fiscal."
      />

      {sp.error ? <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">{sp.error}</p> : null}
      {sp.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">{sp.ok}</p> : null}

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">1. Datos fiscales del negocio</h2>
        <p className="text-xs text-[var(--fo-muted)]">Tal como figuran en ARCA. Salen impresos en cada factura.</p>
        <form action={guardarPerfilAction} className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-[var(--fo-muted)]">CUIT (sólo números)</span>
            <input name="cuit" className="fo-input w-full" inputMode="numeric" defaultValue={perfil?.cuit ?? ""} required />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--fo-muted)]">Razón social (o nombre y apellido)</span>
            <input name="razonSocial" className="fo-input w-full" defaultValue={perfil?.razonSocial ?? ""} required />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--fo-muted)]">Condición frente al IVA</span>
            <select name="ivaCondition" className="fo-input w-full" defaultValue={perfil?.ivaCondition ?? "MONOTRIBUTO"}>
              <option value="MONOTRIBUTO">Monotributo</option>
              <option value="EXENTO">Exento</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--fo-muted)]">Domicilio fiscal</span>
            <input name="domicilioFiscal" className="fo-input w-full" defaultValue={perfil?.domicilioFiscal ?? ""} required />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--fo-muted)]">Ingresos brutos (si no tenés, queda el CUIT)</span>
            <input name="ingresosBrutos" className="fo-input w-full" defaultValue={perfil?.ingresosBrutos ?? ""} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--fo-muted)]">Inicio de actividades</span>
            <input type="date" name="inicioActividades" className="fo-input w-full" defaultValue={perfil?.inicioActividades ?? ""} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--fo-muted)]">Punto de venta de Web Services</span>
            <input name="defaultPointOfSale" className="fo-input w-full" inputMode="numeric" defaultValue={perfil?.defaultPointOfSale ?? ""} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--fo-muted)]">Con qué se factura</span>
            <select name="activeEnvironment" className="fo-input w-full" defaultValue={perfil?.activeEnvironment ?? "HOMOLOGACION"}>
              {ARCA_ENVIRONMENTS.map((e) => (
                <option key={e} value={e}>{ENVIRONMENT_LABELS[e]}</option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="fo-btn fo-btn-primary text-sm">Guardar datos fiscales</button>
          </div>
        </form>
      </section>

      {ARCA_ENVIRONMENTS.map((env, i) => {
        const cred = credenciales.get(env);
        const dias = cred?.certExpiresAt ? diasParaVencer(cred.certExpiresAt, ahora) : null;
        const sufijo = env === "PRODUCCION" ? "prod" : "homo";
        return (
          <section key={env} className="fo-card space-y-4 p-5">
            <h2 className="text-base font-semibold">{i + 2}. {PASOS[env].titulo}</h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {PASOS[env].pasos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>

            <div className="rounded border border-[var(--fo-border)] p-3 text-sm">
              {!cred ? (
                <p className="text-[var(--fo-muted)]">Todavía no hay pedido de certificado para este ambiente.</p>
              ) : cred.status === "ACTIVA" && cred.certExpiresAt ? (
                <p className={dias !== null && dias < 30 ? "text-[var(--fo-danger)]" : "text-[var(--fo-success)]"}>
                  Conectado con el certificado «{cred.alias}». Vence el {fechaAR(cred.certExpiresAt)}
                  {dias !== null ? ` (faltan ${dias} días${dias < 30 ? ": pedí uno nuevo antes de que venza" : ""})` : ""}.
                </p>
              ) : (
                <p>
                  Pedido «{cred.alias}» generado el {fechaAR(cred.createdAt)}. Falta subir el certificado que te da ARCA.{" "}
                  <a className="underline" href={`/api/facturacion/csr/${env.toLowerCase()}`}>Descargar pedido (.csr)</a>
                </p>
              )}
            </div>

            <form action={generarCsrAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="environment" value={env} />
              <label className="space-y-1 text-sm">
                <span className="text-[var(--fo-muted)]">Nombre del certificado (letras y números)</span>
                <input name="alias" className="fo-input" defaultValue={cred?.alias ?? `fotoffice${sufijo}`} pattern="[A-Za-z0-9]{1,50}" required />
              </label>
              {cred?.status === "ACTIVA" ? (
                <label className="flex items-center gap-2 text-xs text-[var(--fo-danger)]">
                  <input type="checkbox" name="reemplazar" value="1" /> Reemplazar el certificado que funciona hoy
                </label>
              ) : null}
              <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                {cred ? "Generar un pedido nuevo" : "Generar pedido de certificado"}
              </button>
            </form>

            {cred ? (
              <form action={subirCertificadoAction} className="space-y-2">
                <input type="hidden" name="environment" value={env} />
                <label className="block space-y-1 text-sm">
                  <span className="text-[var(--fo-muted)]">El certificado que bajaste de ARCA (.crt)</span>
                  <input type="file" name="certificado" accept=".crt,.pem,.cer,.txt" className="block text-sm" />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-[var(--fo-muted)]">…o pegá acá el texto del certificado</span>
                  <textarea name="certificadoTexto" rows={3} className="fo-input w-full font-mono text-xs" placeholder="-----BEGIN CERTIFICATE-----" />
                </label>
                <button type="submit" className="fo-btn fo-btn-secondary text-sm">Subir certificado</button>
              </form>
            ) : null}

            <ProbarConexion environment={env} habilitado={cred?.status === "ACTIVA"} />
          </section>
        );
      })}
    </div>
  );
}
