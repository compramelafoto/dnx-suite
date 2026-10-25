import { redirect } from "next/navigation";
import { TemplateV2RowActions, templateV2EditorPath } from "@repo/template-editor-ui";
import { requireAuth } from "@/lib/auth";
import { NuevoFotolibro } from "@/components/fotolibro/nuevo-fotolibro";
import { RUTA_FOTOLIBROS_SOCIO } from "@/lib/fotolibro/constantes";
import { accesoFotolibrosSocio, listarFotolibrosSocio } from "@/lib/fotolibro/socio";
import { LABORATORIOS_CONOCIDOS } from "@/lib/fotolibro/medidas-pliego";
import { crearFotolibroSocioAction } from "./actions";
// El import registra el runtime del editor: base, sesión y almacenamiento de esta app.
import "@/lib/template-v2/server";

export const dynamic = "force-dynamic";

const fecha = (v: Date) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(v);

/** Los fotolibros del socio: suyos, con la medida real del pliego. La institución no los ve. */
export default async function PortalFotolibrosPage() {
  const user = await requireAuth();
  const context = await accesoFotolibrosSocio(user.id);
  if (!context) redirect("/portal");

  const fotolibros = await listarFotolibrosSocio(user.id);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Mis fotolibros</h1>
        <p className="max-w-3xl text-sm text-[var(--fo-muted)]">
          Elegí la medida y cada hoja sale con el tamaño real del pliego que imprime el laboratorio. Hacé doble clic sobre una
          foto para encuadrarla dentro de su marco.
        </p>
        <p className="max-w-3xl text-xs text-[var(--fo-muted)]">
          {`Lo que diseñás acá es tuyo: ${context.workspace.name} no lo ve.`}
        </p>
      </header>

      <NuevoFotolibro proveedores={[...LABORATORIOS_CONOCIDOS]} accion={crearFotolibroSocioAction} />

      {fotolibros.length === 0 ? (
        <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">Todavía no armaste ningún fotolibro.</p>
      ) : (
        <ul className="space-y-3">
          {fotolibros.map((f) => (
            <li key={f.id} className="fo-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{f.name}</p>
                {f.description ? <p className="text-xs text-[var(--fo-muted)]">{f.description}</p> : null}
                <p className="text-xs text-[var(--fo-muted-soft)]">Editado {fecha(f.updatedAt)}</p>
              </div>
              <TemplateV2RowActions
                templateId={f.id}
                name={f.name}
                editorHref={
                  f.currentVersionId ? templateV2EditorPath(RUTA_FOTOLIBROS_SOCIO, f.id, f.currentVersionId) : null
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
