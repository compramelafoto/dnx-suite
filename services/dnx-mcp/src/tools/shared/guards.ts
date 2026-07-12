export class ToolConfirmationRequiredError extends Error {
  constructor(action: string) {
    super(
      `Confirmación requerida para "${action}". Ejecuta con confirm: true o usa dryRun: true para simular.`,
    );
    this.name = "ToolConfirmationRequiredError";
  }
}

export interface ExecutionGate {
  dryRun: boolean;
  proceed: boolean;
}

/**
 * Controla dryRun y confirmación para operaciones mutables.
 */
export function resolveExecutionGate(
  input: { dryRun?: boolean; confirm?: boolean },
  action: string,
): ExecutionGate {
  const dryRun = input.dryRun ?? false;
  const confirm = input.confirm ?? false;

  if (dryRun) {
    return { dryRun: true, proceed: false };
  }

  if (!confirm) {
    throw new ToolConfirmationRequiredError(action);
  }

  return { dryRun: false, proceed: true };
}

/**
 * Para herramientas de solo lectura que soportan dryRun como vista previa estructural.
 */
export function isDryRunPreview(input: { dryRun?: boolean }): boolean {
  return input.dryRun ?? false;
}
