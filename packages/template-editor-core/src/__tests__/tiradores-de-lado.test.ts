import assert from "node:assert/strict";
import { test } from "node:test";
import { computeResizeRect, computeResizeRectRotated } from "../resize-block-from-handle";
import { snapResizeRect } from "../snap-drag-to-canvas";

const r = { x: 100, y: 100, width: 400, height: 200 };
const sin = { shift: false, alt: false };

test("un lado estira una sola dirección y deja quieto el opuesto", () => {
  assert.deepEqual(computeResizeRect("e", r, 50, 30, sin), { x: 100, y: 100, width: 450, height: 200 });
  assert.deepEqual(computeResizeRect("w", r, 50, 30, sin), { x: 150, y: 100, width: 350, height: 200 });
  assert.deepEqual(computeResizeRect("s", r, 50, 30, sin), { x: 100, y: 100, width: 400, height: 230 });
  assert.deepEqual(computeResizeRect("n", r, 50, 30, sin), { x: 100, y: 130, width: 400, height: 170 });
});

test("un lado ignora Shift: no hay proporción que mantener en una sola dirección", () => {
  assert.deepEqual(computeResizeRect("e", r, 50, 0, { shift: true, alt: false }), { x: 100, y: 100, width: 450, height: 200 });
});

test("girado 90°, el lado 'e' se arrastra hacia abajo y el lado opuesto no se mueve", () => {
  const next = computeResizeRectRotated("e", r, 0, 60, sin, 90);
  assert.equal(Math.round(next.width), 460);
  assert.equal(Math.round(next.height), 200);
  // El medio del lado opuesto ("w"), girado alrededor del centro, queda en el mismo lugar.
  const medioW = (q: typeof r) => {
    const cx = q.x + q.width / 2, cy = q.y + q.height / 2;
    const px = q.x, py = q.y + q.height / 2;
    return { x: Math.round(cx - (py - cy)), y: Math.round(cy + (px - cx)) };
  };
  assert.deepEqual(medioW(next), medioW(r));
});

test("el imán de un lado sólo actúa en su eje", () => {
  const g = { xs: [505], ys: [303] };
  const s = snapResizeRect("e", { x: 100, y: 100, width: 400, height: 200 }, g, 8, false);
  assert.deepEqual(s.rect, { x: 100, y: 100, width: 405, height: 200 });
  assert.equal(s.guideHorizontalY, null);
});
