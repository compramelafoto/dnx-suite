import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import {
  CONSENT_KINDS,
  CONSENT_LABELS,
  DERIVED_SHOWCASE_CONSENT,
  REQUIRED_CONSENTS,
  consentTexts,
} from "@/lib/coverages/consents";
import { isRequestFieldVisible } from "@/lib/coverages/request-fields";
import { resolveCoverageBrand } from "@/lib/coverages/branding";
import { loadSettings } from "@/lib/coverages/repository";
import { terminologyFor } from "@/lib/coverages/terminology";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { CoverageRequestForm } from "./request-form";

export const dynamic = "force-dynamic";

/**
 * El formulario público para pedir una cobertura.
 *
 * Dos condiciones para que exista: el módulo encendido y el formulario abierto. Las dos se
 * comprueban acá, en el origen — si la pantalla apareciera con el formulario cerrado, alguien
 * completaría todo para enterarse al final de que no se estaba recibiendo nada.
 *
 * El guard igual se repite en la acción: esconder un formulario no es un control.
 */
export default async function SolicitarCoberturaPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: {
      workspaceId: true,
      commercialName: true,
      logoUrl: true,
      primaryColor: true,
      accentColor: true,
    },
  });
  if (!branding) notFound();

  const encendido = await isModuleEnabledForWorkspace(
    branding.workspaceId,
    COVERAGES_MODULE_KEY,
  );
  if (!encendido) notFound();

  const settings = await loadSettings(branding.workspaceId);
  const workspace = await prisma.workspace.findUnique({
    where: { id: branding.workspaceId },
    select: { name: true },
  });
  const nombre = branding.commercialName?.trim() || workspace?.name || "la organización";
  const t = terminologyFor(settings);
  // `consentTexts` devuelve la versión realmente servida junto con sus textos: al formulario
  // sólo le interesan los textos, la versión servida ya viaja dentro de cada consentimiento
  // cuando se guarda (ver `parseConsents`).
  const { texts } = consentTexts(settings.consentTextVersion);
  // Se arma acá, en el servidor, y no en el componente cliente: `lib/coverages/consents` usa
  // `node:crypto` a nivel de módulo, y ese módulo no se puede empaquetar para el navegador
  // (ver el comentario en `request-form.tsx`). El cliente recibe sólo estos datos ya resueltos.
  //
  // El permiso de difusión se saca de la lista cuando la institución pregunta por el alcance
  // (`showcaseScope`): son la misma pregunta, una con un tilde y la otra con cuatro niveles, y
  // preguntar las dos es preguntar dos veces lo mismo — con el agravante de que las respuestas
  // pueden contradecirse. El permiso se deduce de la respuesta y se guarda igual, con su texto
  // y su versión (ver `deriveShowcaseConsent`). Con el campo oculto, el tilde vuelve.
  const campos = {
    hidden: settings.requestFormHidden,
    required: settings.requestFormRequired,
  };
  const difusionSeDeduce = isRequestFieldVisible("showcaseScope", campos);
  const consentItems = CONSENT_KINDS.filter(
    (kind) => !(difusionSeDeduce && kind === DERIVED_SHOWCASE_CONSENT),
  ).map((kind) => ({
    kind,
    label: CONSENT_LABELS[kind],
    text: texts[kind],
    required: REQUIRED_CONSENTS.includes(kind),
  }));

  // El color y el logo salen del branding del workspace. `null` si nunca cargaron un color:
  // la pantalla se dibuja entonces con el estilo de siempre, entera y legible. La marca es un
  // agregado, no un requisito (ver `lib/coverages/branding.ts`).
  const marca = resolveCoverageBrand(branding);

  return (
    <div className="bg-[var(--fo-bg)] text-[var(--fo-text)]">
      {/*
        Una franja con el color de la institución, y nada más arriba: sin imagen de portada.
        Mucha gente abre este enlace con datos móviles, y una foto de dos megas antes del
        formulario es la forma más cara de decir lo mismo que dice el logo.
      */}
      {marca ? <div aria-hidden className="h-1.5 w-full" style={{ background: marca.primary }} /> : null}
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
        <header className="space-y-3">
          {/*
            El logo confirma que la persona está en el lugar correcto. El enlace se reparte por
            WhatsApp y quien lo abre no tiene por qué saber qué es FotOffice: lo que tiene que
            reconocer es a la institución a la que le está escribiendo.
          */}
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- el logo vive en R2
            <img
              src={branding.logoUrl}
              alt={`Logo de ${nombre}`}
              className="h-16 w-auto max-w-[200px] object-contain"
            />
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">
            Pedir una cobertura a {nombre}
          </h1>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            Contanos de la actividad y lo revisamos. Te escribimos por correo con una
            respuesta, sea cual sea.
          </p>
        </header>

        {settings.publicFormEnabled ? (
          <CoverageRequestForm
            workspaceSlug={workspaceSlug}
            institutionName={nombre}
            intro={settings.publicFormIntro}
            outro={settings.publicFormOutro}
            consents={consentItems}
            fields={campos}
            brand={marca}
          />
        ) : (
          <section className="fo-card space-y-2 p-6">
            <h2 className="text-base font-semibold">No estamos recibiendo pedidos</h2>
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              En este momento {nombre} no está tomando {t.request.toLowerCase()}es nuevas.
              Volvé a probar más adelante.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
