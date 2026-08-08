/**
 * Evita que router.refresh() / revalidaciones RSC manden el viewport al tope.
 */
export function captureScrollPosition(): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return { x: window.scrollX, y: window.scrollY };
}

export function restoreScrollPosition(pos: { x: number; y: number }): void {
  if (typeof window === "undefined") return;
  const apply = () => window.scrollTo(pos.x, pos.y);
  apply();
  requestAnimationFrame(apply);
  // Next puede completar el soft refresh un poco después del frame actual.
  window.setTimeout(apply, 0);
  window.setTimeout(apply, 50);
  window.setTimeout(apply, 150);
  window.setTimeout(apply, 300);
}

export async function withPreservedScroll<T>(fn: () => Promise<T> | T): Promise<T> {
  const pos = captureScrollPosition();
  try {
    return await fn();
  } finally {
    restoreScrollPosition(pos);
  }
}

export function refreshPreservingScroll(refresh: () => void): void {
  const pos = captureScrollPosition();
  refresh();
  restoreScrollPosition(pos);
}
