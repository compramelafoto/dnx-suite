/**
 * Dirigir a una persona de la calle como modelo.
 *
 * El fotógrafo para a alguien y le da indicaciones, con botones o
 * escribiéndole como le hablaría ("girá un poco a tu izquierda", "mirá a
 * cámara", "reíte", "acercate"). Este módulo traduce esas frases a una pose:
 * hacia dónde gira el cuerpo, adónde mira y qué hace. No usa three.js.
 */

/** Acciones que la persona puede hacer (clips Rocketbox de ambos géneros). */
export type ModelAction =
  | "idle_breathe_01"
  | "idle_look_around_01"
  | "gestic_laugh_low"
  | "gestic_talk_relaxed_01"
  | "wave_01"
  | "idle_touch_hair_01"
  | "cell_phone_textmessage"
  | "claphands_01"
  | "cheer_01"
  | "dancing_neutral"
  | "idle_stretch_arms_01";

export const MODEL_ACTIONS: { id: ModelAction; label: string }[] = [
  { id: "idle_breathe_01", label: "Natural" },
  { id: "gestic_laugh_low", label: "Reírse" },
  { id: "gestic_talk_relaxed_01", label: "Hablar" },
  { id: "wave_01", label: "Saludar" },
  { id: "idle_touch_hair_01", label: "Tocarse el pelo" },
  { id: "cell_phone_textmessage", label: "Mirar el celular" },
  { id: "idle_look_around_01", label: "Mirar alrededor" },
  { id: "claphands_01", label: "Aplaudir" },
  { id: "cheer_01", label: "Agitar los brazos" },
  { id: "dancing_neutral", label: "Bailar" },
  { id: "idle_stretch_arms_01", label: "Estirarse" },
];

import type { Expression } from "../face/face-expressions";

/**
 * Velocidad de los movimientos (multiplica la de la animación). Sirve para
 * practicar larga exposición: un saludo rápido deja la mano barrida.
 */
export const MODEL_TEMPOS: { value: number; label: string }[] = [
  { value: 0.5, label: "Lenta" },
  { value: 1, label: "Normal" },
  { value: 1.8, label: "Rápida" },
  { value: 2.6, label: "Muy rápida" },
];

export interface ModelPose {
  /**
   * Giro del cuerpo respecto de la cámara (grados). 0 = de frente; positivo =
   * el cuerpo apunta hacia la izquierda del cuadro (la derecha de la persona).
   */
  facing: number;
  /** Mirada respecto de la cámara: horizontal (positivo = izquierda del cuadro) y vertical (positivo = arriba). */
  gazeYaw: number;
  gazePitch: number;
  action: ModelAction;
  /** Expresión de la cara. */
  expression: Expression;
  /** Velocidad de los movimientos (1 = natural). */
  tempo: number;
}

export const NATURAL_POSE: ModelPose = {
  facing: 0,
  gazeYaw: 0,
  gazePitch: 0,
  action: "idle_breathe_01",
  expression: "neutral",
  tempo: 1,
};

export type ModelCommand =
  | { kind: "facing"; value: number; relative?: boolean }
  | { kind: "gaze"; yaw: number; pitch: number }
  | { kind: "action"; action: ModelAction }
  | { kind: "expression"; expression: Expression }
  | { kind: "tempo"; value: number }
  | { kind: "move"; meters: number }
  | { kind: "release" };

/** Límites de la mirada respecto del cuerpo: el cuello no gira más. */
export const GAZE_LIMIT_YAW = 70;
export const GAZE_LIMIT_PITCH = 30;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¡!¿?.,;]/g, " ");
}

/**
 * Lado pedido: "tu izquierda" (de la persona) es la derecha del cuadro; "a la
 * izquierda" o "mi izquierda" se entienden desde la cámara.
 */
function side(t: string): 1 | -1 | 0 {
  const left = /izq/.test(t);
  const right = /der/.test(t);
  if (!left && !right) return 0;
  const sign = left ? 1 : -1;
  return (/\btu\b|\bsu\b/.test(t) ? -sign : sign) as 1 | -1;
}

/** Traduce una frase a indicaciones. Si no entiende nada, devuelve []. */
export function parseInstruction(input: string): ModelCommand[] {
  const t = normalize(input);
  const out: ModelCommand[] = [];
  const s = side(t);

  if (/\b(gracias|segui|listo|podes irte|chau|anda nomas)\b/.test(t)) return [{ kind: "release" }];

  // Cuerpo.
  if (/espalda|date vuelta|dame la espalda/.test(t)) out.push({ kind: "facing", value: 180 });
  else if (/perfil/.test(t)) out.push({ kind: "facing", value: 90 * (s || 1) });
  else if (/tres cuartos|3\/4/.test(t)) out.push({ kind: "facing", value: 35 * (s || 1) });
  else if (/\b(gira|giraa|rota|dobla|volteate|volvete)\w*/.test(t) && s) {
    out.push({ kind: "facing", value: (/un poco|apenas|poquito/.test(t) ? 15 : 30) * s, relative: true });
  } else if (/de frente|ponete de frente|parate de frente/.test(t)) out.push({ kind: "facing", value: 0 });

  // Mirada.
  if (/mira(me)?\b.*(camara|aca|lente|objetivo)|mirame|mira a camara/.test(t)) out.push({ kind: "gaze", yaw: 0, pitch: 0 });
  else if (/mira\w*.*(arriba|cielo)/.test(t)) out.push({ kind: "gaze", yaw: 0, pitch: 20 });
  else if (/mira\w*.*(abajo|piso|suelo)/.test(t)) out.push({ kind: "gaze", yaw: 0, pitch: -20 });
  else if (/mira\w*.*(lejos|horizonte|fuera|afuera)/.test(t)) out.push({ kind: "gaze", yaw: 45 * (s || 1), pitch: 0 });
  else if (/mira\w*/.test(t) && s) out.push({ kind: "gaze", yaw: 40 * s, pitch: 0 });

  // Cara.
  if (/sonre|sonrisa/.test(t)) out.push({ kind: "expression", expression: "smile" });
  else if (/\brei|risa|carcajada/.test(t)) out.push({ kind: "expression", expression: "laugh" });
  else if (/serio|seria|seriedad/.test(t)) out.push({ kind: "expression", expression: "serious" });
  else if (/enoja|bronca|enfada|furios/.test(t)) out.push({ kind: "expression", expression: "angry" });
  else if (/triste|tristeza/.test(t)) out.push({ kind: "expression", expression: "sad" });
  else if (/sorprend|asombr/.test(t)) out.push({ kind: "expression", expression: "surprised" });
  else if (/pensativ|pensa en algo|concentrad/.test(t)) out.push({ kind: "expression", expression: "pensive" });
  else if (/cara natural|cara normal|relaja la cara/.test(t)) out.push({ kind: "expression", expression: "neutral" });

  // Acciones.
  if (/\brei|risa|carcajada/.test(t)) out.push({ kind: "action", action: "gestic_laugh_low" });
  else if (/(agita|move|mueve|sacudi|revolea|levanta)\w*.*\b(brazos|manos)\b|festeja|hinchada/.test(t)) {
    out.push({ kind: "action", action: "cheer_01" });
  } else if (/salud/.test(t)) out.push({ kind: "action", action: "wave_01" });
  else if (/baila/.test(t)) out.push({ kind: "action", action: "dancing_neutral" });
  else if (/habla|charla|conta(me)?/.test(t)) out.push({ kind: "action", action: "gestic_talk_relaxed_01" });
  else if (/pelo|cabello/.test(t)) out.push({ kind: "action", action: "idle_touch_hair_01" });
  else if (/celular|telefono|mensaje/.test(t)) out.push({ kind: "action", action: "cell_phone_textmessage" });
  else if (/aplaud/.test(t)) out.push({ kind: "action", action: "claphands_01" });
  else if (/estira/.test(t)) out.push({ kind: "action", action: "idle_stretch_arms_01" });
  else if (/alrededor|distraid/.test(t)) out.push({ kind: "action", action: "idle_look_around_01" });
  else if (/natural|relaj|quiet|tranqui|normal/.test(t)) out.push({ kind: "action", action: "idle_breathe_01" });

  // Velocidad de los movimientos.
  if (/muy rapido|rapidisimo|a full|lo mas rapido/.test(t)) out.push({ kind: "tempo", value: 2.6 });
  else if (/rapid|ligero|con energia|con ganas/.test(t)) out.push({ kind: "tempo", value: 1.8 });
  else if (/lento|lenta|despacio|suave/.test(t)) out.push({ kind: "tempo", value: 0.5 });
  else if (/velocidad normal|ritmo normal/.test(t)) out.push({ kind: "tempo", value: 1 });

  // Distancia.
  if (/acerca|veni|mas cerca/.test(t)) out.push({ kind: "move", meters: /un poco|apenas/.test(t) ? -0.5 : -1 });
  else if (/aleja|para atras|retroced|mas lejos/.test(t)) out.push({ kind: "move", meters: /un poco|apenas/.test(t) ? 0.5 : 1 });

  return out;
}

function wrap180(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

/** Aplica una indicación a la pose (las de distancia y "seguí" las resuelve la escena). */
export function applyCommand(pose: ModelPose, cmd: ModelCommand): ModelPose {
  switch (cmd.kind) {
    case "facing": {
      const facing = cmd.relative ? pose.facing + cmd.value : cmd.value;
      return { ...pose, facing: cmd.value === 180 && !cmd.relative ? 180 : wrap180(facing) };
    }
    case "gaze":
      return {
        ...pose,
        gazeYaw: Math.max(-GAZE_LIMIT_YAW, Math.min(GAZE_LIMIT_YAW, cmd.yaw)),
        gazePitch: Math.max(-GAZE_LIMIT_PITCH, Math.min(GAZE_LIMIT_PITCH, cmd.pitch)),
      };
    case "action":
      return { ...pose, action: cmd.action };
    case "expression":
      return { ...pose, expression: cmd.expression };
    case "tempo":
      return { ...pose, tempo: Math.max(0.25, Math.min(3, cmd.value)) };
    default:
      return pose;
  }
}

/** Lo que contesta la persona: confirma o pide que le expliquen. */
export function modelReply(commands: ModelCommand[], seed: number): string {
  if (commands.length === 0) return ["¿Cómo? No te entendí.", "¿Me lo explicás de otra forma?", "Perdón, ¿qué querés que haga?"][seed % 3];
  if (commands.some((c) => c.kind === "release")) return "¡Gracias! Después pasame la foto.";
  return ["¡Dale!", "¿Así?", "Ok, ¿así está bien?", "Listo.", "Bueno, ¿así?"][seed % 5];
}

/**
 * Rumbo del cuerpo (rotation.y para un avatar que mira a +Z) que corresponde
 * a la pose, dado dónde está la cámara respecto de la persona.
 */
export function bodyHeading(person: { x: number; z: number }, camera: { x: number; z: number }, facingDeg: number): number {
  // Hacia la cámara.
  const tx = camera.x - person.x;
  const tz = camera.z - person.z;
  const toCamera = Math.atan2(tx, tz);
  // Positivo: el cuerpo apunta a la izquierda del cuadro. Visto desde la cámara,
  // su izquierda queda a la derecha de la persona: girar en sentido horario visto desde arriba.
  return toCamera - (facingDeg * Math.PI) / 180;
}
