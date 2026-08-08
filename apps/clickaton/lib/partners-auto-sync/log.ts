export function logAutoSync(event: string, data: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      scope: "dnx_partners_auto_sync",
      event,
      ...data,
      ts: new Date().toISOString(),
    }),
  );
}
