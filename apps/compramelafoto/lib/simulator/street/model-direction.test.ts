import assert from "node:assert/strict";
import { test } from "node:test";

import { NATURAL_POSE, applyCommand, bodyHeading, modelReply, parseInstruction } from "./model-direction";

const pose = (text: string, from = NATURAL_POSE) => parseInstruction(text).reduce(applyCommand, from);

test("entiende indicaciones típicas de una sesión", () => {
  assert.equal(pose("Ponete de perfil").facing, 90);
  assert.equal(pose("tres cuartos a la derecha").facing, -35);
  assert.equal(pose("date vuelta").facing, 180);
  assert.equal(pose("Mirá a cámara").gazeYaw, 0);
  assert.equal(pose("mirá hacia arriba").gazePitch, 20);
  assert.equal(pose("¡Reíte!").action, "gestic_laugh_low");
  assert.equal(pose("Agarrá el celular").action, "cell_phone_textmessage");
  assert.equal(pose("tocate el pelo").action, "idle_touch_hair_01");
});

test("'tu izquierda' es la de la persona (la derecha del cuadro)", () => {
  assert.equal(pose("girá a tu izquierda").facing, -30);
  assert.equal(pose("girá a la izquierda").facing, 30);
  assert.equal(pose("girá un poco a la izquierda").facing, 15);
});

test("los giros relativos se suman y la mirada no pasa el límite del cuello", () => {
  const p = pose("girá un poco a la izquierda", pose("tres cuartos a la izquierda"));
  assert.equal(p.facing, 50);
  const g = applyCommand(NATURAL_POSE, { kind: "gaze", yaw: 200, pitch: -90 });
  assert.equal(g.gazeYaw, 70);
  assert.equal(g.gazePitch, -30);
});

test("varias indicaciones en una frase", () => {
  const cmds = parseInstruction("ponete de perfil, mirá a cámara y reíte");
  assert.deepEqual(cmds.map((c) => c.kind), ["facing", "gaze", "action"]);
});

test("acercarse, alejarse y despedirse", () => {
  assert.deepEqual(parseInstruction("acercate un poco"), [{ kind: "move", meters: -0.5 }]);
  assert.deepEqual(parseInstruction("alejate"), [{ kind: "move", meters: 1 }]);
  assert.deepEqual(parseInstruction("gracias, podés seguir"), [{ kind: "release" }]);
});

test("si no entiende, lo dice", () => {
  assert.deepEqual(parseInstruction("hacé la vertical"), []);
  assert.match(modelReply([], 0), /No te entendí|otra forma|qué querés/);
});

test("el cuerpo gira hacia el lado pedido visto desde la cámara", () => {
  const person = { x: 0, z: 0 };
  const camera = { x: 0, z: -10 };
  // De frente: mira a la cámara (−Z).
  const front = bodyHeading(person, camera, 0);
  assert.ok(Math.abs(Math.cos(front) - -1) < 1e-9);
  // Perfil +90: apunta a la izquierda del cuadro. La cámara mira a +Z, su izquierda es +X.
  const profile = bodyHeading(person, camera, 90);
  assert.ok(Math.abs(Math.sin(profile) - 1) < 1e-9);
});
