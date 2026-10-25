/**
 * Estado de "dirigir a un modelo" compartido entre el panel (React, fuera
 * del 3D) y la escena (loop de render). Se lee con useSyncExternalStore.
 */

import {
  NATURAL_POSE,
  applyCommand,
  modelReply,
  parseInstruction,
  type ModelCommand,
  type ModelPose,
} from "./model-direction";

export interface PersonRef {
  id: string;
  name: string;
  distance: number;
}

export interface ModelState {
  /** Persona a la que se está mirando y a la que se le puede hablar. */
  nearby: PersonRef | null;
  /** Persona detenida que está posando. */
  model: PersonRef | null;
  pose: ModelPose;
  /** Lo último que contestó y cuándo (ms). */
  reply: string | null;
  replyAt: number;
}

let state: ModelState = { nearby: null, model: null, pose: NATURAL_POSE, reply: null, replyAt: 0 };
const listeners = new Set<() => void>();
/** Pedidos de distancia (m, positivo = alejarse) que consume la escena. */
const pendingMoves: number[] = [];
let replies = 0;

function set(next: Partial<ModelState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

export const modelStore = {
  getState: (): ModelState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Lo llama la escena cuando cambia a quién se está mirando. */
  setNearby(nearby: PersonRef | null) {
    if (state.nearby?.id === nearby?.id && Math.abs((state.nearby?.distance ?? 0) - (nearby?.distance ?? 0)) < 0.5) return;
    set({ nearby });
  },

  /** "Disculpá, ¿te puedo sacar una foto?": detiene a la persona mirada. */
  talkToNearby(): boolean {
    if (!state.nearby || state.model) return false;
    set({ model: state.nearby, pose: NATURAL_POSE, reply: "¡Hola! Sí, dale. ¿Qué querés que haga?", replyAt: Date.now() });
    return true;
  },

  /** Indicaciones ya armadas (botones del panel). */
  send(commands: ModelCommand[]) {
    if (!state.model) return;
    if (commands.some((c) => c.kind === "release")) {
      pendingMoves.length = 0;
      set({ model: null, pose: NATURAL_POSE, reply: modelReply(commands, replies++), replyAt: Date.now() });
      return;
    }
    let pose = state.pose;
    for (const c of commands) {
      if (c.kind === "move") pendingMoves.push(c.meters);
      else pose = applyCommand(pose, c);
    }
    set({ pose, reply: modelReply(commands, replies++), replyAt: Date.now() });
  },

  /** Lo que el fotógrafo le dice con sus palabras. */
  say(text: string): ModelCommand[] {
    const commands = parseInstruction(text);
    if (commands.length === 0) {
      set({ reply: modelReply([], replies++), replyAt: Date.now() });
      return commands;
    }
    this.send(commands);
    return commands;
  },

  release() {
    this.send([{ kind: "release" }]);
  },

  /** La escena toma el próximo pedido de distancia, si hay. */
  takeMove(): number | null {
    return pendingMoves.shift() ?? null;
  },
};
