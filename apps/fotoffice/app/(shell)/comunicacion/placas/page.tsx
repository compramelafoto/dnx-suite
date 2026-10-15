import Link from "next/link";
import { PartyPopper } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CopyCaptionButton } from "@/components/placas/copy-caption-button";
import { requireCommunicationsViewer } from "@/lib/placas/access";
import { listMembersWithoutWelcome, listWelcomes, type WelcomeRow } from "@/lib/placas/welcomes";
import { listKeyedTemplates } from "@/lib/template-v2/keyed-template";
import { isPlacaTemplateKey, placaTemplateKey, type PlacaFormat } from "@/lib/placas/constants";
import { placaPhoto, placaSpecialty, placaZone, welcomeCaption } from "@/lib/placas/values";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { prisma } from "@repo/db";
import {
  addWelcomeAction,
  removeWelcomeAction,
  setWelcomePublishedAction,
} from "@/app/actions/placas";

export const dynamic = "force-dynamic";

const fecha = (v: Date) =>
  new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" }).format(v);

function urlPlaca(memberId: string, format: PlacaFormat, descargar = false) {
  return `/api/comunicacion/placas/${memberId}/bienvenida/${format}${descargar ? "?descargar=1" : ""}`;
}

/**
 * Comunicación → Placas → Bienvenidas.
 *
 * Cada socio nuevo aparece solo cuando paga su primera cuota. Las placas no se muestran todas de
 * entrada: cada una se dibuja en el servidor al pedirla, y con decenas de socios la pantalla
 * tardaría en abrir. Se ven al desplegar "Ver placa".
 */
export default async function BienvenidasPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { workspace, canManage } = await requireCommunicationsViewer();
  const params = await searchParams;
  const v = await loadPersonVocabulary(workspace.id);

  let filas: WelcomeRow[] = [];
  let faltaMigracion = false;
  try {
    filas = await listWelcomes(workspace.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/(?:table|relation).*does not exist|P2021/i.test(message)) throw error;
    faltaMigracion = true;
  }

  const [plantillas, branding, sinBienvenida] = await Promise.all([
    listKeyedTemplates(workspace.id).catch(() => []),
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: workspace.id },
      select: { commercialName: true },
    }),
    canManage && !faltaMigracion ? listMembersWithoutWelcome(workspace.id) : Promise.resolve([]),
  ]);
  const institucion = branding?.commercialName?.trim() || workspace.name;
  const conPlantillaPropia = plantillas.some(
    (t) => t.templateKey === placaTemplateKey("bienvenida", "cuadrada") ||
      t.templateKey === placaTemplateKey("bienvenida", "historia"),
  );
  const algunaPlaca = plantillas.some((t) => isPlacaTemplateKey(t.templateKey));

  const pendientes = filas.filter((f) => !f.publishedAt);
  const publicadas = filas.filter((f) => f.publishedAt);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Bienvenidas"
        description={`Cada ${v.singular} nuevo aparece acá cuando paga su primera cuota, con su placa lista para descargar y publicar en redes.`}
        actions={
          canManage ? (
            <Link href="/comunicacion/plantillas" className="fo-btn fo-btn-secondary text-sm">
              Diseñar las placas
            </Link>
          ) : null
        }
      />

      {params.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? (
        <p className="fo-alert-success p-4 text-sm" role="status">
          {params.ok}
        </p>
      ) : null}

      {faltaMigracion ? (
        <section className="fo-card space-y-2 p-8">
          <p className="text-sm font-medium">Las bienvenidas todavía no están habilitadas.</p>
          <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
            Falta crear su tabla en la base de datos. Es una migración pendiente, no un error de
            esta pantalla.
          </p>
        </section>
      ) : null}

      {!faltaMigracion && !conPlantillaPropia ? (
        <p className="fo-alert-warning p-4 text-sm">
          Las placas salen con el diseño base de FOTOFFICE.{" "}
          {canManage ? (
            <Link href="/comunicacion/plantillas" className="underline underline-offset-2">
              {algunaPlaca ? "Terminá de diseñar" : "Diseñá"} la de bienvenida con los colores y
              el logo de la institución.
            </Link>
          ) : (
            "Quien gestiona Comunicación puede diseñarlas con los colores y el logo de la institución."
          )}
        </p>
      ) : null}

      {!faltaMigracion ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Para publicar <span className="text-[var(--fo-muted)]">({pendientes.length})</span>
          </h2>
          {pendientes.length === 0 ? (
            <div className="fo-card flex items-center gap-3 p-6 text-sm text-[var(--fo-muted)]">
              <PartyPopper className="h-5 w-5" aria-hidden />
              No hay bienvenidas pendientes. Cuando un {v.singular} nuevo pague su primera cuota,
              va a aparecer acá.
            </div>
          ) : (
            <ul className="space-y-3">
              {pendientes.map((f) => (
                <Bienvenida key={f.id} fila={f} institucion={institucion} canManage={canManage} />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {publicadas.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Ya publicadas <span className="text-[var(--fo-muted)]">({publicadas.length})</span>
          </h2>
          <ul className="space-y-3">
            {publicadas.map((f) => (
              <Bienvenida key={f.id} fila={f} institucion={institucion} canManage={canManage} />
            ))}
          </ul>
        </section>
      ) : null}

      {canManage && !faltaMigracion ? (
        <section className="fo-card space-y-3 p-5">
          <h2 className="text-sm font-semibold">Sumar una bienvenida a mano</h2>
          <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
            Solo entran solos quienes se asociaron con la solicitud y pagaron. Si diste de alta a
            alguien a mano, sumalo desde acá.
          </p>
          {sinBienvenida.length === 0 ? (
            <p className="text-xs text-[var(--fo-muted)]">
              Todos los {v.plural} activos ya tienen su bienvenida.
            </p>
          ) : (
            <form action={addWelcomeAction} className="flex flex-wrap items-end gap-2">
              <label className="fo-field-stack min-w-64 flex-1">
                <span className="fo-label">{v.Singular}</span>
                <select name="memberId" className="fo-input" required defaultValue="">
                  <option value="" disabled>
                    Elegí a quién
                  </option>
                  {sinBienvenida.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.lastName}, {m.firstName} · N° {m.memberNumber} · desde {fecha(m.joinedAt)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="fo-btn fo-btn-primary text-sm">
                Sumar a la lista
              </button>
            </form>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Bienvenida({
  fila,
  institucion,
  canManage,
}: {
  fila: WelcomeRow;
  institucion: string;
  canManage: boolean;
}) {
  const m = fila.member;
  const foto = placaPhoto(m);
  const detalle = [placaSpecialty(m.specialties), placaZone(m)].filter(Boolean).join(" · ");
  const texto = welcomeCaption({ member: m, institutionName: institucion });

  return (
    <li className="fo-card space-y-4 p-5">
      <div className="flex flex-wrap items-start gap-4">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto de R2, ya optimizada al subirla
          <img src={foto} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--fo-surface-muted)] text-xs text-[var(--fo-muted)]">
            sin foto
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">
            {m.firstName} {m.lastName}{" "}
            <span className="text-xs font-normal text-[var(--fo-muted)]">N° {m.memberNumber}</span>
          </p>
          {detalle ? <p className="text-xs text-[var(--fo-muted)]">{detalle}</p> : null}
          <p className="text-xs text-[var(--fo-muted-soft)]">
            {fila.source === "MANUAL" ? "Sumado a mano" : "Se asoció"} el {fecha(fila.createdAt)}
            {fila.publishedAt
              ? ` · publicada el ${fecha(fila.publishedAt)}${fila.publishedByName ? ` por ${fila.publishedByName}` : ""}`
              : ""}
          </p>
          {!foto ? (
            <p className="text-xs text-[var(--fo-warning)]">
              No tiene foto de perfil: la placa sale con sus iniciales. Conviene pedírsela.
            </p>
          ) : null}
          {m.status !== "ACTIVE" ? (
            <p className="text-xs text-[var(--fo-warning)]">Ya no está activo.</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={urlPlaca(fila.memberId, "cuadrada", true)} className="fo-btn fo-btn-primary text-xs">
          Descargar cuadrada
        </a>
        <a href={urlPlaca(fila.memberId, "historia", true)} className="fo-btn fo-btn-secondary text-xs">
          Descargar historia
        </a>
        <CopyCaptionButton text={texto} />
        <form action={setWelcomePublishedAction}>
          <input type="hidden" name="welcomeId" value={fila.id} />
          <input type="hidden" name="published" value={fila.publishedAt ? "0" : "1"} />
          <button type="submit" className="fo-btn fo-btn-ghost text-xs">
            {fila.publishedAt ? "Marcar como no publicada" : "Marcar como publicada"}
          </button>
        </form>
        {canManage ? (
          <form action={removeWelcomeAction}>
            <input type="hidden" name="welcomeId" value={fila.id} />
            <button type="submit" className="fo-btn fo-btn-ghost text-xs text-[var(--fo-danger)]">
              Quitar de la lista
            </button>
          </form>
        ) : null}
      </div>

      <details className="group">
        <summary className="cursor-pointer text-xs text-[var(--fo-muted)] underline underline-offset-2">
          Ver placa y texto
        </summary>
        <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- PNG que se dibuja al pedirlo */}
            <img
              src={urlPlaca(fila.memberId, "cuadrada")}
              alt={`Placa de bienvenida de ${m.firstName} ${m.lastName}, cuadrada`}
              loading="lazy"
              className="w-full max-w-xs rounded-lg border border-[var(--fo-border)]"
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- PNG que se dibuja al pedirlo */}
            <img
              src={urlPlaca(fila.memberId, "historia")}
              alt={`Placa de bienvenida de ${m.firstName} ${m.lastName}, historia`}
              loading="lazy"
              className="w-40 rounded-lg border border-[var(--fo-border)]"
            />
          </div>
          <p className="max-w-sm whitespace-pre-line rounded-lg border border-[var(--fo-border)] p-3 text-xs leading-relaxed">
            {texto}
          </p>
        </div>
      </details>
    </li>
  );
}
