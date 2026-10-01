/**
 * Dibuja una placa de participante con el motor de `design-studio`, el mismo que imprime el
 * carnet de socio de FotoOffice.
 *
 * Existe porque el otro camino —armar una página web y fotografiarla con un navegador— obliga
 * a mantener un servidor con Chromium fuera de Vercel, con su costo y su despliegue aparte.
 * El puente `editorADocumento` ya traduce un diseño del editor visual al documento que sabe
 * dibujar `design-studio`, así que la placa puede salir del DNX Designer sin ningún navegador.
 *
 * Recibe el documento **con las variables ya resueltas**, que es lo que el resto del sistema
 * venía entregándole al navegador. Por eso acá no se resuelve ninguna variable: de los
 * formateadores, los alias y los valores por defecto ya se ocupó el motor de plantillas, y
 * duplicar esa lógica sería la forma más segura de que la placa y la vista previa dejaran de
 * coincidir.
 */
import type { ResolvedTemplateDocument } from "@repo/template-engine";
import { editorADocumento } from "@repo/template-editor-core/rendering";
import { emitDesign, type ResourceResolver } from "@repo/design-studio";
import { cardRenderFailed } from "./participant-card-errors";
import type { ParticipantCardRenderProvider } from "./participant-card-render-provider";
import {
  getClickatonParticipantCardPreset,
  type ClickatonCardPreset,
} from "./participant-card-presets";
import { resolveClickatonParticipantCardDocument } from "./participant-card-renderer";
import type {
  ClickatonParticipantCardType,
  ParticipantCardSourceSummary,
} from "./participant-card-types";

export type DesignStudioRenderResult = {
  png: Buffer;
  width: number;
  height: number;
  durationMs: number;
  /** Lo que el puente no supo traducir. Vacío en una placa sana. */
  warnings: string[];
};

/**
 * La dirección pública del sitio, para completar las relativas.
 *
 * Una plantilla del editor guarda las imágenes que se suben como `/api/media/…`. En un
 * navegador esa dirección se completa sola; en el servidor no apunta a ningún lado.
 */
function direccionPublica(): string {
  const raw =
    // eslint-disable-next-line turbo/no-undeclared-env-vars -- mismas que usa la placa de sponsors
    process.env.NEXT_PUBLIC_CLICKATON_URL?.trim() ||
    process.env.CLICKATON_PUBLIC_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  return raw.replace(/\/$/, "");
}

export type ParticipantCardResourceDeps = {
  fetchImpl?: typeof fetch;
};

/**
 * Entrega los bytes de las imágenes que el diseño referencia.
 *
 * `design-studio` no sabe de red a propósito: recibe bytes. Acepta tres formas, porque las tres
 * aparecen en una placa: la foto del participante llega incrustada como `data:`, el logo
 * también, y lo que alguien sube a una plantilla queda con dirección relativa.
 */
export function createParticipantCardResourceResolver(
  deps: ParticipantCardResourceDeps = {}
): ResourceResolver {
  const pedir = deps.fetchImpl ?? fetch;

  return {
    async read(ref: string): Promise<Uint8Array | null> {
      const embebida = /^data:[^;,]*;base64,(.*)$/s.exec(ref);
      if (embebida) {
        try {
          return new Uint8Array(Buffer.from(embebida[1]!, "base64"));
        } catch {
          return null;
        }
      }

      /*
       * Las imágenes que alguien sube a una plantilla quedan guardadas con dirección relativa.
       * Sin completarlas, la placa falla con "No se encontró la imagen" aunque el archivo esté
       * subido y accesible.
       */
      const url = ref.startsWith("/") ? `${direccionPublica()}${ref}` : ref;
      if (!/^https?:\/\//.test(url)) return null;

      try {
        const respuesta = await pedir(url);
        if (!respuesta.ok) return null;
        return new Uint8Array(await respuesta.arrayBuffer());
      } catch {
        return null;
      }
    },
  };
}

type BloqueDelEditor = Parameters<typeof editorADocumento>[0]["blocks"][number];

const BLOQUES_DE_IMAGEN = new Set(["IMAGE", "PHOTO", "BACKGROUND"]);

/**
 * Saca del bloque la referencia a la variable cuando su valor ya está adentro.
 *
 * Un bloque de imagen resuelto trae la dirección en `src` y, además, el nombre de la variable
 * de la que salió. El puente le da prioridad al nombre, así que sin esto la placa se emitiría
 * pidiendo una variable que ya nadie tiene que llenar, y fallaría.
 */
function fijarBloqueResuelto(
  type: string,
  config: Record<string, unknown>
): Record<string, unknown> {
  if (!BLOQUES_DE_IMAGEN.has(type)) return config;
  const src = typeof config.src === "string" ? config.src.trim() : "";
  if (!src) return config;

  const source = { ...((config.source as Record<string, unknown>) ?? {}) };
  delete source.variableKey;
  const fijo: Record<string, unknown> = { ...config, source };
  delete fijo.variableKey;
  return fijo;
}

/**
 * El tipo con el que el puente tiene que leer el bloque.
 *
 * Un hueco de foto ya resuelto es una imagen concreta: sabe qué archivo va adentro. El puente
 * trata el hueco como "la foto de la persona" y le busca una variable, así que se lo presenta
 * como imagen para que use el archivo que ya tiene. El recorte redondo se conserva: los dos
 * tipos leen `maskShape` igual.
 */
function tipoParaElPuente(type: string, config: Record<string, unknown>): string {
  if (type === "VARIABLE_TEXT") return "TEXT";
  const src = typeof config.src === "string" ? config.src.trim() : "";
  if (type === "PHOTO" && src) return "IMAGE";
  return type;
}

/**
 * Pasa el documento resuelto a la forma que espera el puente.
 *
 * Los bloques atados a un dato —el nombre, la foto— ya llegan con su valor adentro, así que se
 * los convierte en bloques fijos. Si se los dejara como bloques variables, el puente volvería a
 * escribir el marcador `{{...}}` y la placa saldría con el nombre de la variable en vez del
 * nombre de la persona.
 */
function documentoResueltoAEditor(document: ResolvedTemplateDocument): {
  canvas: Parameters<typeof editorADocumento>[0]["canvas"];
  blocks: BloqueDelEditor[];
} {
  return {
    canvas: {
      width: document.width,
      height: document.height,
      background: document.background?.color ?? null,
      // El lienzo se mide en píxeles de pantalla; el puente los convierte usando este dpi.
      dpi: 300,
      // Una placa para redes no se imprime ni se recorta: sin sangrado ni área segura.
      bleedMm: 0,
      safeAreaMm: 0,
    },
    blocks: document.blocks.map((block) => {
      const original = (block.config ?? {}) as Record<string, unknown>;
      const config = fijarBloqueResuelto(block.type, original);
      const type = tipoParaElPuente(block.type, config);
      return {
        id: block.id,
        type,
        name: block.name ?? null,
        pageIndex: block.pageIndex ?? 0,
        x: block.layout.x,
        y: block.layout.y,
        width: block.layout.width,
        height: block.layout.height,
        rotation: block.layout.rotation ?? 0,
        zIndex: block.layout.zIndex ?? 0,
        opacity: block.layout.opacity ?? 1,
        locked: block.layout.locked ?? false,
        visible: block.layout.visible ?? true,
        configJson: config,
      } as BloqueDelEditor;
    }),
  };
}

/** Dibuja un documento resuelto con `design-studio`. Sin navegador. */
export async function renderResolvedDocumentWithDesignStudio(
  document: ResolvedTemplateDocument
): Promise<DesignStudioRenderResult> {
  const inicio = Date.now();
  const editor = documentoResueltoAEditor(document);

  const puente = editorADocumento({
    canvas: editor.canvas,
    blocks: editor.blocks,
    nombre: document.name,
  });

  const salida = await emitDesign({
    document: puente.document,
    // Las variables ya vienen resueltas dentro del documento: acá no queda ninguna por llenar.
    contract: { variables: [] },
    values: {},
    formats: ["PNG_PER_SIDE"],
    resources: createParticipantCardResourceResolver(),
    fileBaseName: "clickaton-card",
  });

  if (!salida.ok) {
    throw cardRenderFailed(salida.errors.join(" · "));
  }

  const archivo = salida.files.find((f) => f.contentType === "image/png");
  if (!archivo) {
    throw cardRenderFailed("La emisión no devolvió ningún PNG");
  }

  return {
    png: Buffer.from(archivo.bytes),
    width: document.width,
    height: document.height,
    durationMs: Date.now() - inicio,
    warnings: puente.avisos,
  };
}

/** El motor de dibujo local, en la forma que espera el resto del sistema. */
export class DesignStudioRenderProvider implements ParticipantCardRenderProvider {
  readonly id = "design-studio";

  async render(input: { document: ResolvedTemplateDocument }) {
    const rendered = await renderResolvedDocumentWithDesignStudio(input.document);
    return {
      png: rendered.png,
      width: rendered.width,
      height: rendered.height,
      durationMs: rendered.durationMs,
    };
  }
}

export type RenderWithDesignStudioInput = {
  cardType: ClickatonParticipantCardType;
  templateData: Record<string, unknown>;
  preset?: ClickatonCardPreset;
};

export type RenderWithDesignStudioResult = {
  png: Buffer;
  width: number;
  height: number;
  mimeType: "image/png";
  durationMs: number;
  sourceSummary: ParticipantCardSourceSummary;
  renderWarnings: string[];
};

/**
 * Resuelve el diseño y lo dibuja de una sola vez.
 *
 * Es el atajo que usan las pruebas y las herramientas de mano; el sistema en producción entra
 * por `DesignStudioRenderProvider`, que recibe el documento ya resuelto.
 */
export async function renderClickatonParticipantCardWithDesignStudio(
  input: RenderWithDesignStudioInput
): Promise<RenderWithDesignStudioResult> {
  const preset = input.preset ?? getClickatonParticipantCardPreset(input.cardType);
  const { document } = resolveClickatonParticipantCardDocument({
    cardType: input.cardType,
    templateData: input.templateData,
    preset,
  });

  const rendered = await renderResolvedDocumentWithDesignStudio(document);

  return {
    png: rendered.png,
    width: rendered.width,
    height: rendered.height,
    mimeType: "image/png",
    durationMs: rendered.durationMs,
    renderWarnings: rendered.warnings,
    sourceSummary: {
      presetId: preset.presetId,
      templateKey: preset.meta.templateKey,
      templateVersion: preset.meta.templateVersion,
      blockCount: document.blocks.length,
      imageCount: document.blocks.filter(
        (b) => b.type === "IMAGE" || b.type === "PHOTO"
      ).length,
    },
  };
}
