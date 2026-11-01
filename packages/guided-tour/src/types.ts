import type { ReactNode } from "react";

export type TourPlacement = "auto" | "top" | "bottom" | "left" | "right" | "center";

export type TourStep = {
  /**
   * Selector CSS de la sección que se ilumina (lo habitual: `[data-tour="album-pestanas"]`).
   * Sin selector, el globo aparece en el centro de la pantalla.
   */
  target?: string;
  title: string;
  body: ReactNode;
  placement?: TourPlacement;
  /** Selector de un elemento al que se le hace clic antes de mostrar el paso (por ejemplo, una pestaña). */
  activate?: string;
  /** Acción libre antes de mostrar el paso (cambiar de pestaña con estado propio, abrir un panel…). */
  before?: () => void | Promise<void>;
  /** Margen alrededor de la sección iluminada, en px. */
  padding?: number;
};

export type TourDefinition = {
  /** Identificador estable: es la clave con la que se recuerda si el usuario ya lo vio. */
  id: string;
  /** Subirlo cuando la pantalla cambie lo suficiente como para volver a ofrecer el recorrido. */
  version: number;
  /** Nombre de la pantalla, tal como lo lee el usuario ("el editor de fotolibros"). */
  screenName: string;
  /** Una oración que invita a hacer el recorrido. */
  intro: string;
  steps: TourStep[];
  /** Se llama al terminar u omitir el recorrido (por ejemplo, para volver a la primera pestaña). */
  onClose?: () => void;
};

export type TourOutcome = "done" | "skipped" | "dismissed";
