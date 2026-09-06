import assert from "node:assert/strict";
import { test } from "node:test";
import { degradeMentionPlan, planMentions } from "./mentions";

const candidatos = [
  { handle: "fotografo", priority: 1, role: "PHOTOGRAPHER" },
  { handle: "organizador", priority: 2, role: "ORGANIZER" },
  { handle: "sponsor", priority: 3, role: "SPONSOR" },
  { handle: "compramelafoto", priority: 4, role: "PLATFORM" },
];

test("los primeros van como colaboradores y el resto al copy", () => {
  const plan = planMentions(candidatos, 3);
  assert.deepEqual(plan.collaborators, ["fotografo", "organizador", "sponsor"]);
  assert.deepEqual(plan.captionMentions, ["compramelafoto"]);
});

test("respeta la prioridad aunque lleguen desordenados", () => {
  const plan = planMentions([...candidatos].reverse(), 2);
  assert.deepEqual(plan.collaborators, ["fotografo", "organizador"]);
  assert.deepEqual(plan.captionMentions, ["sponsor", "compramelafoto"]);
});

test("no repite un handle que viene dos veces", () => {
  const plan = planMentions(
    [...candidatos, { handle: "fotografo", priority: 9, role: "OTRO" }],
    3,
  );
  assert.equal(plan.collaborators.filter((h) => h === "fotografo").length, 1);
  assert.ok(!plan.captionMentions.includes("fotografo"));
});

test("ignora handles vacíos en vez de mandar basura a Meta", () => {
  const plan = planMentions(
    [{ handle: "  ", priority: 1, role: "X" }, ...candidatos],
    3,
  );
  assert.ok(!plan.collaborators.includes("  "));
  assert.equal(plan.collaborators.length + plan.captionMentions.length, 4);
});

test("con cero candidatos el plan queda vacío, no falla", () => {
  assert.deepEqual(planMentions([], 3), { collaborators: [], captionMentions: [] });
});

test("degradar mueve el último colaborador al frente del copy", () => {
  const plan = planMentions(candidatos, 3);
  const menor = degradeMentionPlan(plan);
  assert.deepEqual(menor?.collaborators, ["fotografo", "organizador"]);
  assert.deepEqual(menor?.captionMentions, ["sponsor", "compramelafoto"]);
});

test("degradar sin colaboradores devuelve null: no hay nada más que bajar", () => {
  assert.equal(degradeMentionPlan({ collaborators: [], captionMentions: ["a"] }), null);
});

test("nadie se pierde al degradar", () => {
  let plan = planMentions(candidatos, 4);
  for (let i = 0; i < 4; i++) {
    const siguiente = degradeMentionPlan(plan);
    if (!siguiente) break;
    plan = siguiente;
  }
  assert.equal(plan.collaborators.length + plan.captionMentions.length, 4);
});
