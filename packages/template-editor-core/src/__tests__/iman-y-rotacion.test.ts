import assert from "node:assert/strict";
import { test } from "node:test";
import { computeResizeRect, computeResizeRectRotated } from "../resize-block-from-handle";
import { snapRotationDeg } from "../rotation-math";
import { snapDragPosition } from "../snap-drag-to-canvas";

test("con Shift la rotación se pega a los ángulos rectos y avanza de a 15°", () => {
  assert.equal(snapRotationDeg(84), 90);
  assert.equal(snapRotationDeg(-95), -90);
  assert.equal(snapRotationDeg(178), 180);
  assert.equal(snapRotationDeg(37), 30);
  assert.equal(snapRotationDeg(3), 0);
});

test("sin giro, el cambio de tamaño es el de siempre", () => {
  const start = { x: 100, y: 100, width: 200, height: 100 };
  assert.deepEqual(
    computeResizeRectRotated("se", start, 50, 20, { shift: false, alt: false }, 0),
    computeResizeRect("se", start, 50, 20, { shift: false, alt: false }),
  );
});

test("girada 90°, arrastrar hacia abajo agranda el ancho y la esquina opuesta no se mueve", () => {
  const start = { x: 100, y: 100, width: 200, height: 100 };
  // A 90° el borde "derecho" del bloque queda abajo en pantalla.
  const next = computeResizeRectRotated("se", start, 0, 60, { shift: false, alt: false }, 90);
  assert.equal(Math.round(next.width), 260);
  assert.equal(Math.round(next.height), 100);
  // La esquina "nw" (opuesta a "se"), girada alrededor del centro, queda en el mismo lugar.
  const giro = (r: typeof start, px: number, py: number) => {
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    return { x: Math.round(cx - (py - cy)), y: Math.round(cy + (px - cx)) };
  };
  assert.deepEqual(giro(next, next.x, next.y), giro(start, start.x, start.y));
});

test("con Shift, el imán pega un bloque al costado de otro y a la zona segura", () => {
  const otro = {
    id: "a",
    type: "SHAPE",
    pageIndex: 0,
    layout: { x: 100, y: 100, width: 100, height: 100, rotation: 0, zIndex: 0, opacity: 1, locked: false, visible: true },
    configJson: {},
  };
  // Sin Shift, a 20 px del borde derecho del otro no pasa nada.
  const libre = snapDragPosition(1000, 1000, 50, 50, 220, 500, "b", [otro as never]);
  assert.equal(libre.x, 220);
  // Con Shift se pega a su borde derecho (x = 200).
  const iman = snapDragPosition(1000, 1000, 50, 50, 220, 500, "b", [otro as never], undefined, { magnet: true });
  assert.equal(iman.x, 200);
  const segura = snapDragPosition(1000, 1000, 50, 50, 70, 520, "b", [], undefined, {
    magnet: true,
    guidesX: [50, 950],
    guidesY: [50, 950],
  });
  assert.equal(segura.x, 50);
});
