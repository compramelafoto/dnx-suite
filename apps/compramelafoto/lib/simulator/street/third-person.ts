/**
 * Vista en tercera persona de la calle: la cámara se aleja y se ve al
 * fotógrafo (su avatar) con los flashes alrededor, para acomodarlos. Mientras
 * está activa no se camina ni se saca la foto.
 */

import { FIGURES } from "@/lib/simulator/studio-light/figures";

/** Personas que se pueden elegir como avatar (las de la calle, sin la bailarina). */
export const AVATAR_FIGURES = FIGURES.filter((f) => f.id !== "bailarina" && f.id !== "mia");
export const DEFAULT_AVATAR = "tomas";

export function isAvatarFigure(id: unknown): id is string {
  return typeof id === "string" && AVATAR_FIGURES.some((f) => f.id === id);
}

export interface ThirdPersonState {
  on: boolean;
  figure: string;
}

let state: ThirdPersonState = { on: false, figure: DEFAULT_AVATAR };
const listeners = new Set<() => void>();

function set(next: ThirdPersonState) {
  state = next;
  for (const l of listeners) l();
}

export const thirdPersonStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get(): ThirdPersonState {
    return state;
  },
  setOn(on: boolean) {
    set({ ...state, on });
  },
  setFigure(figure: string) {
    if (isAvatarFigure(figure)) set({ ...state, figure });
  },
};
