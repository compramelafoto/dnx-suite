const DEFAULT_MIN_DELAY_MS = 800;

/** Espera mínima antes de salir a Mercado Pago (mejor percepción de “pedido guardado”). */
export function delayBeforeMpRedirect(ms: number = DEFAULT_MIN_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function redirectToMercadoPago(
  initPoint: string,
  opts?: { minDelayMs?: number; startedAt?: number }
): Promise<void> {
  const minDelay = opts?.minDelayMs ?? DEFAULT_MIN_DELAY_MS;
  const startedAt = opts?.startedAt ?? Date.now();
  const elapsed = Date.now() - startedAt;
  if (elapsed < minDelay) {
    await delayBeforeMpRedirect(minDelay - elapsed);
  }
  window.location.href = initPoint;
}
