"use client";

import { useActionState, useState, type CSSProperties } from "react";
import type { CoverageBrand } from "@/lib/coverages/branding";
import type { ConsentKind } from "@/lib/coverages/consents";
import {
  OTHER_OPTION_VALUE,
  requestFieldOptions,
  requestFieldOtherInputName,
  visibleRequestSections,
  type ResolvedRequestField,
  type RequestFormFieldConfig,
} from "@/lib/coverages/request-fields";
import {
  submitCoverageRequestAction,
  type CoverageRequestFormState,
} from "@/app/actions/coverage-request";

const inicial: CoverageRequestFormState = { error: null, ok: null };

/** Un permiso ya resuelto por el servidor: etiqueta, texto de la versión vigente y si es obligatorio. */
export type ConsentItem = {
  kind: ConsentKind;
  label: string;
  text: string;
  required: boolean;
};

/**
 * El formulario público.
 *
 * Lo completa alguien que no conoce el sistema, casi siempre desde el teléfono. De ahí las
 * decisiones de forma: una sola columna, campos táctiles de 44 px para arriba, y los permisos
 * al final con su texto completo a la vista en vez de detrás de un enlace que nadie abre.
 *
 * Las secciones están numeradas y cada una dice para qué sirve lo que pide. Veintiséis campos
 * seguidos se leen como un censo; en etapas, se leen como una conversación, y quien completa
 * sabe siempre cuánto le falta. El texto de 16 px no es un capricho: con menos, iOS hace zoom
 * solo al tocar un campo y la persona pierde de vista el formulario.
 *
 * `useActionState` deja el botón deshabilitado mientras se envía, que es lo que evita el doble
 * pedido cuando la conexión está lenta y la persona vuelve a apretar.
 *
 * Los permisos llegan ya armados desde `page.tsx` (`ConsentItem[]`), en vez de importar acá
 * `CONSENT_KINDS`/`CONSENT_LABELS`/`REQUIRED_CONSENTS` de `lib/coverages/consents`: ese módulo
 * usa `node:crypto` (`hashConsentText`) a nivel de módulo, y Webpack no puede empaquetarlo para
 * el cliente. Sólo el tipo `ConsentKind` cruza la frontera, como `import type` — se borra en
 * la compilación y no arrastra el módulo.
 */
export function CoverageRequestForm({
  workspaceSlug,
  institutionName,
  intro,
  outro,
  consents,
  fields,
  brand,
}: {
  workspaceSlug: string;
  institutionName: string;
  intro: string | null;
  outro: string | null;
  consents: ConsentItem[];
  fields: RequestFormFieldConfig;
  brand: CoverageBrand | null;
}) {
  const accion = submitCoverageRequestAction.bind(null, workspaceSlug);
  const [state, formAction, pending] = useActionState(accion, inicial);
  // `lib/coverages/request-fields` sí se puede importar acá —es un módulo puro, sin `node:crypto`
  // ni Prisma— así que la pantalla resuelve qué dibujar con la misma regla que usa la acción
  // para validar. Si las dos leyeran listas distintas, el formulario pediría una cosa y el
  // servidor exigiría otra.
  const secciones = visibleRequestSections(fields);

  /**
   * La marca, puesta como variables del sistema de diseño.
   *
   * Pisando `--fo-accent` y `--fo-accent-muted` en el formulario, todo lo que ya las usaba —el
   * borde de un campo enfocado, el número de cada etapa— toma el color de la institución sin
   * una regla nueva por elemento. Sin marca, no se pisa nada y rige el celeste de siempre.
   */
  const estilo: CSSProperties | undefined = brand
    ? ({
        accentColor: brand.accent,
        "--fo-accent": brand.accent,
        "--fo-accent-muted": brand.soft,
      } as CSSProperties)
    : undefined;

  if (state.ok) {
    return (
      <SolicitudRecibida
        mensaje={state.ok}
        publicCode={state.publicCode ?? null}
        institutionName={institutionName}
        outro={outro}
        brand={brand}
      />
    );
  }

  // Las etapas se numeran sobre lo que realmente se ve: si la institución apagó una sección
  // entera, la ONG tiene que leer 1, 2, 3 y no 1, 3, 4.
  const totalEtapas = secciones.length + 1;

  return (
    // `accentColor` pinta las tildes de los permisos con el color de la institución. Es una
    // propiedad del navegador: si el color no sirviera, la tilde vuelve sola a la del sistema.
    <form action={formAction} className="space-y-6" style={estilo}>
      {intro ? (
        <p className="rounded-xl border border-[var(--fo-border)] bg-[var(--fo-surface)] p-4 text-sm leading-relaxed text-[var(--fo-text-secondary)]">
          {intro}
        </p>
      ) : null}

      <p className="text-xs text-[var(--fo-muted)]">
        Los campos con <span className="font-semibold">*</span> son obligatorios. El resto, sólo
        si lo tenés a mano.
      </p>

      {secciones.map((seccion, i) => (
        <fieldset key={seccion.key} className="fo-card space-y-5 p-5 sm:p-6">
          {/*
            El nombre accesible del grupo va en el `legend`, escondido a la vista: arriba se
            dibuja el mismo título con su número y su para qué, que es lo que ordena la lectura.
          */}
          <legend className="sr-only">{seccion.legend}</legend>
          <Etapa numero={i + 1} total={totalEtapas} titulo={seccion.legend} ayuda={seccion.hint} />
          <div className="space-y-4">
            {seccion.fields.map((campo) => (
              <Campo key={campo.key} campo={campo} />
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset className="fo-card space-y-5 p-5 sm:p-6">
        <legend className="sr-only">Permisos</legend>
        <Etapa
          numero={totalEtapas}
          total={totalEtapas}
          titulo="Permisos"
          ayuda={`Leé cada uno. Los marcados con * son necesarios para que ${institutionName} pueda tomar el pedido.`}
        />
        <div className="space-y-4">
          {consents.map((c) => (
            <label
              key={c.kind}
              className="flex gap-3 rounded-lg border border-[var(--fo-border)] p-3 text-sm leading-relaxed"
            >
              <input
                type="checkbox"
                name={`consent_${c.kind}`}
                className="mt-0.5 size-5 shrink-0"
                required={c.required}
              />
              <span>
                <span className="font-medium">
                  {c.label}
                  {c.required ? " *" : ""}
                </span>
                <br />
                <span className="text-[var(--fo-muted)]">{c.text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {state.error}
        </p>
      ) : null}

      {/*
        El cierre, antes del botón. Es lo último que se lee habiendo completado todo: el lugar
        del agradecimiento y de lo que conviene decir cuando la persona ya hizo su parte. Se
        repite en la pantalla de "listo, lo recibimos", que es cuando más se agradece leerlo.
      */}
      {outro ? <TextoDeCierre texto={outro} /> : null}

      {/*
        Con la marca cargada, el botón va con el color de la institución y el texto que se lee
        encima —blanco o negro, lo decide la luminancia y no una suposición—. Sin marca,
        `fo-btn-primary` deja el botón como el resto del sistema. `.fo-btn` a secas no pinta
        ningún fondo, así que sin la variante el botón venía transparente.
      */}
      <button
        type="submit"
        className="fo-btn fo-btn-primary min-h-12 w-full"
        disabled={pending}
        style={brand ? { background: brand.primary, color: brand.onPrimary } : undefined}
      >
        {pending ? "Enviando…" : "Enviar el pedido"}
      </button>
    </form>
  );
}

/** El encabezado de una etapa: en qué paso va, cómo se llama y para qué sirve lo que pide. */
function Etapa({
  numero,
  total,
  titulo,
  ayuda,
}: {
  numero: number;
  total: number;
  titulo: string;
  ayuda: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-sm font-semibold text-[var(--fo-accent)]"
      >
        {numero}
      </span>
      <div className="min-w-0 space-y-0.5">
        <h2 className="text-base font-semibold leading-tight">
          {titulo}{" "}
          <span className="text-xs font-normal text-[var(--fo-muted)]">
            paso {numero} de {total}
          </span>
        </h2>
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{ayuda}</p>
      </div>
    </div>
  );
}

// 16 px (`text-base`) y no el 14 px del resto del sistema: con menos, iOS hace zoom al tocar
// el campo. El borde de foco sale de `--fo-accent`, que el formulario pisa con el color de la
// institución cuando tiene uno.
const CLASES_CONTROL =
  "w-full min-h-11 rounded-lg border border-[var(--fo-border-strong)] bg-[var(--fo-bg-elevated)] px-3 py-2.5 text-base outline-none transition focus:border-[var(--fo-accent)] focus:ring-4 focus:ring-[var(--fo-accent-muted)]";

/**
 * Un campo del catálogo, dibujado según su tipo.
 *
 * Recibe el campo entero y no sus partes sueltas: la etiqueta, la ayuda, las opciones y el
 * estado son todos del mismo catálogo, y pasarlos de a uno era la forma de que algún día
 * quedara uno afuera. Los de elección se van por su propio camino porque no son un `input`
 * sino un grupo de controles con su nombre accesible.
 */
function Campo({ campo }: { campo: ResolvedRequestField }) {
  const obligatorio = campo.state === "OBLIGATORIO";
  if (campo.input === "choice") return <CampoEleccion campo={campo} required={obligatorio} />;
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">
        {campo.label}
        {obligatorio ? " *" : ""}
      </span>
      {campo.hint ? <Ayuda texto={campo.hint} /> : null}
      {campo.input === "textarea" ? (
        <textarea name={campo.key} rows={3} className={CLASES_CONTROL} required={obligatorio} />
      ) : (
        <input
          name={campo.key}
          type={campo.input}
          className={CLASES_CONTROL}
          required={obligatorio}
        />
      )}
    </label>
  );
}

/** La ayuda de un campo: por qué se pregunta, en las palabras de quien lo lee. */
function Ayuda({ texto }: { texto: string }) {
  return (
    <span className="block text-xs leading-relaxed text-[var(--fo-muted)]">{texto}</span>
  );
}

/**
 * Un campo de elección: una respuesta entre varias, y "Otros" con su texto libre.
 *
 * Botones de opción y no una lista desplegable: en el teléfono, un desplegable esconde las
 * respuestas hasta que se toca, y acá las respuestas son la pregunta —"con restricciones" y
 * "no suban ninguna foto" no significan lo mismo ni por asomo—. Toda la fila es tocable, no
 * sólo el círculo.
 *
 * El `required` va en cada opción del grupo: es como el navegador entiende "elegí una de
 * estas". Igual el control que manda es el del servidor, que valida contra la misma lista.
 *
 * El texto libre aparece recién cuando se elige "Otros": mostrarlo siempre es ofrecer un campo
 * que la mayoría no tiene que completar, y esconderlo del todo es pedir una aclaración sin
 * dónde escribirla.
 */
function CampoEleccion({
  campo,
  required,
}: {
  campo: ResolvedRequestField;
  required: boolean;
}) {
  const [elegida, setElegida] = useState("");
  const opciones = requestFieldOptions(campo);

  return (
    <fieldset className="block space-y-1.5">
      <legend className="text-sm font-medium">
        {campo.label}
        {required ? " *" : ""}
      </legend>
      {campo.hint ? <Ayuda texto={campo.hint} /> : null}
      <div className="space-y-2 pt-1">
        {opciones.map((opcion) => (
          <label
            key={opcion.value}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-[var(--fo-border)] p-3 text-base leading-relaxed has-[:checked]:border-[var(--fo-accent)]"
          >
            <input
              type="radio"
              name={campo.key}
              value={opcion.value}
              checked={elegida === opcion.value}
              onChange={() => setElegida(opcion.value)}
              className="mt-0.5 size-5 shrink-0"
              required={required}
            />
            <span>{opcion.label}</span>
          </label>
        ))}
        {campo.allowsOther && elegida === OTHER_OPTION_VALUE ? (
          <input
            name={requestFieldOtherInputName(campo.key)}
            type="text"
            className={CLASES_CONTROL}
            placeholder="Contanos cuál"
            aria-label={`${campo.label} — contanos cuál`}
          />
        ) : null}
      </div>
    </fieldset>
  );
}

/**
 * El cierre que escribió la institución.
 *
 * Se respetan los renglones tal como los escribió —`whitespace-pre-line`— porque casi siempre
 * son varios párrafos cortos: un agradecimiento escrito de corrido deja de leerse.
 */
function TextoDeCierre({ texto }: { texto: string }) {
  return (
    <p className="whitespace-pre-line rounded-xl border border-[var(--fo-border)] bg-[var(--fo-surface)] p-4 text-sm leading-relaxed text-[var(--fo-text-secondary)]">
      {texto}
    </p>
  );
}

/**
 * Lo que la ONG recibe a cambio.
 *
 * Es el único momento del circuito en que quien pidió se lleva algo, y hasta acá era un párrafo.
 * El número va grande y con un botón para copiarlo porque es lo que después le va a dar a la
 * institución cuando pregunte por su pedido; y abajo dice qué va a pasar, para que nadie se
 * quede esperando una respuesta que no sabe por dónde llega.
 *
 * Si el portapapeles falla —o el navegador no lo permite— el número igual está a la vista para
 * copiarlo a mano: no se muestra un error por algo que la persona puede resolver sola.
 */
function SolicitudRecibida({
  mensaje,
  publicCode,
  institutionName,
  outro,
  brand,
}: {
  mensaje: string;
  publicCode: string | null;
  institutionName: string;
  outro: string | null;
  brand: CoverageBrand | null;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!publicCode) return;
    try {
      await navigator.clipboard.writeText(publicCode);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <section className="fo-card space-y-6 p-6">
      <div className="space-y-2">
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-full text-xl"
          style={{
            background: brand?.soft ?? "var(--fo-success-soft)",
            color: brand?.primary ?? "var(--fo-success)",
          }}
        >
          ✓
        </span>
        <h2 className="text-xl font-semibold tracking-tight">Listo, lo recibimos</h2>
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{mensaje}</p>
      </div>

      {publicCode ? (
        <div className="space-y-3 rounded-xl border border-dashed border-[var(--fo-border-strong)] p-4 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted)]">
            Tu número de pedido
          </p>
          <p className="select-all text-3xl font-bold tabular-nums tracking-tight">{publicCode}</p>
          <button type="button" onClick={copiar} className="fo-btn fo-btn-secondary min-h-11 w-full">
            {copiado ? "¡Copiado!" : "Copiar el número"}
          </button>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Qué pasa ahora</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[var(--fo-text-secondary)]">
          <li>
            El número también te llega por correo, a la dirección que dejaste, con un enlace para
            seguir el pedido cuando quieras.
          </li>
          <li>Alguien de {institutionName} lo revisa.</li>
          <li>Te escribimos con una respuesta, sea cual sea.</li>
        </ol>
        <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
          Si el correo no aparece, mirá en el correo no deseado antes de volver a enviar el
          pedido.
        </p>
      </div>

      {/*
        El mismo cierre que está al pie del formulario, otra vez acá. No es una repetición por
        descuido: al pie lo lee quien todavía está completando y tiene la cabeza en el próximo
        campo; acá lo lee alguien que ya terminó. Es el momento en que más se agradece leerlo.
      */}
      {outro ? <TextoDeCierre texto={outro} /> : null}
    </section>
  );
}
