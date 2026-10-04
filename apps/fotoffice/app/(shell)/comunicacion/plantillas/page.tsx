import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireCommunicationsManager } from "@/lib/placas/access";
import { listKeyedTemplates } from "@/lib/template-v2/keyed-template";
import {
  PLACA_FORMATS,
  PLACA_FORMAT_LABEL,
  PLACA_FORMAT_PX,
  PLACA_KINDS,
  PLACA_KIND_LABEL,
  placaTemplateKey,
} from "@/lib/placas/constants";
import { createPlacaTemplateAction } from "@/app/actions/placas";
import { PLACAS_EDITOR_BASE_PATH } from "@/lib/placas/editor-path";

export const dynamic = "force-dynamic";

const fecha = (v: Date) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(v);

const PARA_QUE: Record<(typeof PLACA_KINDS)[number], string> = {
  bienvenida: "Se arma sola para cada socio nuevo cuando paga su primera cuota.",
  "socio-semana": "La del socio destacado de cada viernes.",
};

/**
 * Comunicación → Plantillas.
 *
 * Las placas se diseñan con el mismo editor del carnet. Cada combinación de tipo y formato es
 * una plantilla con su marca (`placa-<tipo>-<formato>-v1`); la primera vez se trae el diseño
 * base para no arrancar con la hoja en blanco.
 */
export default async function PlantillasDePlacasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspace } = await requireCommunicationsManager();
  const params = await searchParams;

  let plantillas: Awaited<ReturnType<typeof listKeyedTemplates>> = [];
  let faltaMigracion = false;
  try {
    plantillas = await listKeyedTemplates(workspace.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/(?:table|relation).*does not exist|P2021/i.test(message)) throw error;
    faltaMigracion = true;
  }
  const porMarca = new Map(plantillas.map((t) => [t.templateKey, t]));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Plantillas de placas"
        description="El diseño de las placas para redes. Se editan con el mismo diseñador del carnet: fondo, colores, tipografías, logo y dónde va cada dato. Los datos del socio se completan solos."
      />

      {params.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {params.error}
        </p>
      ) : null}

      {faltaMigracion ? (
        <section className="fo-card space-y-2 p-8">
          <p className="text-sm font-medium">El editor de plantillas todavía no está habilitado.</p>
          <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
            Falta crear las tablas del módulo de diseño en esta base de datos.
          </p>
        </section>
      ) : (
        PLACA_KINDS.map((kind) => (
          <section key={kind} className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">{PLACA_KIND_LABEL[kind]}</h2>
              <p className="text-xs text-[var(--fo-muted)]">{PARA_QUE[kind]}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {PLACA_FORMATS.map((format) => {
                const t = porMarca.get(placaTemplateKey(kind, format));
                const px = PLACA_FORMAT_PX[format];
                return (
                  <div key={format} className="fo-card flex flex-col gap-3 p-5">
                    <div>
                      <p className="text-sm font-medium">{PLACA_FORMAT_LABEL[format]}</p>
                      <p className="text-xs text-[var(--fo-muted)]">
                        {px.width} × {px.height} px
                      </p>
                    </div>
                    {t ? (
                      <>
                        <p className="text-xs text-[var(--fo-muted-soft)]">
                          Última edición: {fecha(t.updatedAt)}
                        </p>
                        <Link
                          href={`${PLACAS_EDITOR_BASE_PATH}/${t.templateId}/${t.versionId}`}
                          className="fo-btn fo-btn-primary self-start text-sm"
                        >
                          Editar diseño
                        </Link>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-[var(--fo-muted-soft)]">
                          Hoy sale con el diseño base de FOTOFFICE.
                        </p>
                        <form action={createPlacaTemplateAction}>
                          <input type="hidden" name="kind" value={kind} />
                          <input type="hidden" name="format" value={format} />
                          <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                            Crear desde el diseño base
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <section className="fo-card space-y-2 p-5 text-xs leading-relaxed text-[var(--fo-muted)]">
        <p className="text-sm font-medium text-[var(--fo-text)]">Consejos para diseñar</p>
        <p>
          En el panel de datos del editor, el grupo <strong>Placas</strong> tiene la foto de
          perfil, las iniciales, la zona, la especialidad y el Instagram del socio.
        </p>
        <p>
          Dejá las <strong>iniciales debajo de la foto</strong>: si alguien no tiene foto, la foto
          no se dibuja y quedan las iniciales a la vista.
        </p>
        <p>
          Si un dato falta, no se dibuja. Ninguna placa deja de salir porque un socio no haya
          cargado su Instagram o su especialidad.
        </p>
      </section>
    </div>
  );
}
