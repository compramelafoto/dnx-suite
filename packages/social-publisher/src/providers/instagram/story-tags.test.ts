import assert from "node:assert/strict";
import { test } from "node:test";
import { crearHistoriaConEtiquetas, userTagsParam } from "./instagram-publish";

test("sin ancla, las etiquetas van sin posición (como antes)", () => {
  assert.equal(userTagsParam(["a", "b"]), JSON.stringify([{ username: "a" }, { username: "b" }]));
});

test("con ancla, la primera va en el ancla y las demás apiladas debajo", () => {
  const r = JSON.parse(userTagsParam(["foto", "org", "marca"], { x: 0.4, y: 0.77 }));
  assert.deepEqual(r, [
    { username: "foto", x: 0.4, y: 0.77 },
    { username: "org", x: 0.4, y: 0.805 },
    { username: "marca", x: 0.4, y: 0.84 },
  ]);
});

test("la posición nunca se sale de la imagen", () => {
  const r = JSON.parse(userTagsParam(["a", "b"], { x: 1.4, y: 0.94 }));
  assert.equal(r[0].x, 0.95);
  assert.equal(r[1].y, 0.95);
});

test("si Meta acepta la posición, la historia sale con ella", async () => {
  const pedidos: Record<string, string>[] = [];
  const r = await crearHistoriaConEtiquetas(
    async (b) => {
      pedidos.push(b);
      return "c1";
    },
    { media_type: "STORIES" },
    ["foto"],
    { x: 0.5, y: 0.7 },
  );
  assert.equal(r.conPosicion, true);
  assert.deepEqual(r.dropped, []);
  assert.deepEqual(JSON.parse(pedidos[0]!.user_tags!), [{ username: "foto", x: 0.5, y: 0.7 }]);
});

test("si Meta rechaza la posición, se repite sin ella y la etiqueta no se pierde", async () => {
  let n = 0;
  const r = await crearHistoriaConEtiquetas(
    async (b) => {
      n++;
      if (b.user_tags?.includes('"x"')) throw new Error("Invalid parameter user_tags");
      return `c${n}`;
    },
    { media_type: "STORIES" },
    ["foto"],
    { x: 0.5, y: 0.7 },
  );
  assert.equal(r.conPosicion, false);
  assert.deepEqual(r.dropped, []);
});
