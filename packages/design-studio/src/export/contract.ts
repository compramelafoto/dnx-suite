import type { VariableContract, VariableValues } from "../variables/contract";
import type { ResourceResolver } from "../render/resources";

/**
 * Formatos de esta primera versión. El contrato admite más —plancha imprimible, ZIP, marcas
 * de corte, perfil de color— y esos llegan cuando haya emisión masiva.
 */
export type EmissionFormat = "PDF" | "PNG_PER_SIDE" | "SVG_PER_SIDE";

export type EmittedFile = {
  name: string;
  contentType: string;
  bytes: Uint8Array;
  /** SHA-256 en hexadecimal. Permite verificar que un archivo guardado es el que se emitió. */
  checksum: string;
};

export type EmitRequest = {
  /** Crudo: `emitDesign` lo migra y lo valida. */
  document: unknown;
  contract: VariableContract;
  values: VariableValues;
  formats: EmissionFormat[];
  /** Solo PRINT. Por defecto, sin sangrado. */
  includeBleed?: boolean;
  /** Solo PNG. Por defecto, el dpi que declara el documento. */
  pngDpi?: number;
  resources: ResourceResolver;
  /** Sin extensión. Se le agrega la cara y el formato. */
  fileBaseName: string;
};

export type EmitOutcome =
  | {
      ok: true;
      files: EmittedFile[];
      /** Lo que la emisión tiene que guardar para poder reproducirse. */
      rendererVersion: string;
      schemaVersion: number;
      /**
       * Los valores tal como se dibujaron, ya convertidos a texto. Guardar esto —y no lo que
       * el producto creía estar mandando— es lo que permite reproducir la pieza: si mañana
       * cambia el formato de fecha, la pieza vieja se rehace con el texto que tenía.
       */
      resolvedValues: Record<string, string>;
      /** Variables opcionales que no vinieron. Queda registrado, como pide la spec. */
      omittedVariables: string[];
    }
  | { ok: false; errors: string[] };
