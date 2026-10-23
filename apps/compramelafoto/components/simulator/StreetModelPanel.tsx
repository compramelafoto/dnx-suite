"use client";

import { EXPRESSIONS } from "@/lib/simulator/face/face-expressions";
import { MODEL_ACTIONS, type ModelCommand } from "@/lib/simulator/street/model-direction";
import { modelStore } from "@/lib/simulator/street/model-store";
import { useEffect, useState, useSyncExternalStore } from "react";

const BODY: { label: string; cmd: ModelCommand }[] = [
  { label: "De frente", cmd: { kind: "facing", value: 0 } },
  { label: "¾ izquierda", cmd: { kind: "facing", value: 35 } },
  { label: "¾ derecha", cmd: { kind: "facing", value: -35 } },
  { label: "Perfil izquierda", cmd: { kind: "facing", value: 90 } },
  { label: "Perfil derecha", cmd: { kind: "facing", value: -90 } },
  { label: "De espaldas", cmd: { kind: "facing", value: 180 } },
];

const GAZE: { label: string; cmd: ModelCommand }[] = [
  { label: "A cámara", cmd: { kind: "gaze", yaw: 0, pitch: 0 } },
  { label: "Izquierda", cmd: { kind: "gaze", yaw: 40, pitch: 0 } },
  { label: "Derecha", cmd: { kind: "gaze", yaw: -40, pitch: 0 } },
  { label: "Arriba", cmd: { kind: "gaze", yaw: 0, pitch: 20 } },
  { label: "Abajo", cmd: { kind: "gaze", yaw: 0, pitch: -20 } },
];

const DISTANCE: { label: string; cmd: ModelCommand }[] = [
  { label: "Acercate", cmd: { kind: "move", meters: -1 } },
  { label: "Alejate", cmd: { kind: "move", meters: 1 } },
];

/** Escucha la T para hablarle a quien se está mirando. */
function useTalkKey() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "KeyT" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (modelStore.talkToNearby()) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/**
 * Parar a una persona de la calle y dirigirla como modelo: cuerpo, mirada,
 * acción y distancia, con botones o con palabras.
 */
export default function StreetModelPanel() {
  const state = useSyncExternalStore(modelStore.subscribe, modelStore.getState, modelStore.getState);
  const [text, setText] = useState("");
  useTalkKey();

  // Sólo en desarrollo: manejar al modelo desde la consola o Playwright.
  useEffect(() => {
    if (process.env.NODE_ENV === "development") (globalThis as Record<string, unknown>).__codModel = modelStore;
  }, []);

  if (!state.model) {
    if (!state.nearby) return null;
    return (
      <button type="button" className="cod-model-chip" onClick={() => modelStore.talkToNearby()}>
        <kbd className="cod-kbd">T</kbd> Hablar con {state.nearby.name} · {state.nearby.distance.toFixed(0)} m
      </button>
    );
  }

  const facing = state.pose.facing;
  const submit = () => {
    if (!text.trim()) return;
    modelStore.say(text);
    setText("");
  };

  return (
    <aside className="cod-model-panel" aria-label={`Dirigir a ${state.model.name}`}>
      <header className="cod-model-panel__header">
        <strong>{state.model.name}</strong>
        <span>está posando para vos</span>
      </header>
      {state.reply ? (
        <p className="cod-model-panel__reply" key={state.replyAt}>
          “{state.reply}”
        </p>
      ) : null}

      <form
        className="cod-model-panel__say"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          placeholder="«Girá un poco a tu izquierda»"
          aria-label="Indicación para el modelo"
        />
        <button type="submit">Decir</button>
      </form>

      <details className="cod-model-panel__group">
        <summary className="cod-model-panel__label">Cuerpo</summary>
        <div className="cod-model-panel__chips">
        {BODY.map((b) => (
          <button
            key={b.label}
            type="button"
            className={b.cmd.kind === "facing" && b.cmd.value === facing ? "is-active" : ""}
            onClick={() => modelStore.send([b.cmd])}
          >
            {b.label}
          </button>
        ))}
        </div>
      </details>

      <details className="cod-model-panel__group">
        <summary className="cod-model-panel__label">Mirada</summary>
        <div className="cod-model-panel__chips">
        {GAZE.map((g) => (
          <button
            key={g.label}
            type="button"
            className={
              g.cmd.kind === "gaze" && g.cmd.yaw === state.pose.gazeYaw && g.cmd.pitch === state.pose.gazePitch ? "is-active" : ""
            }
            onClick={() => modelStore.send([g.cmd])}
          >
            {g.label}
          </button>
        ))}
        </div>
      </details>

      <details className="cod-model-panel__group">
        <summary className="cod-model-panel__label">Cara</summary>
        <div className="cod-model-panel__chips">
          {EXPRESSIONS.map((e) => (
            <button
              key={e.id}
              type="button"
              className={e.id === state.pose.expression ? "is-active" : ""}
              onClick={() => modelStore.send([{ kind: "expression", expression: e.id }])}
            >
              {e.label}
            </button>
          ))}
        </div>
      </details>

      <details className="cod-model-panel__group">
        <summary className="cod-model-panel__label">Qué hace</summary>
        <div className="cod-model-panel__chips">
        {MODEL_ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={a.id === state.pose.action ? "is-active" : ""}
            onClick={() => modelStore.send([{ kind: "action", action: a.id }])}
          >
            {a.label}
          </button>
        ))}
        </div>
      </details>

      <details className="cod-model-panel__group">
        <summary className="cod-model-panel__label">Distancia</summary>
        <div className="cod-model-panel__chips">
        {DISTANCE.map((d) => (
          <button key={d.label} type="button" onClick={() => modelStore.send([d.cmd])}>
            {d.label}
          </button>
        ))}
        </div>
      </details>

      <button type="button" className="cod-model-panel__release" onClick={() => modelStore.release()}>
        Gracias, podés seguir
      </button>
    </aside>
  );
}
