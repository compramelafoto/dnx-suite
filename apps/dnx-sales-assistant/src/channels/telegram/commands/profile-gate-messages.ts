export function textProfileNotConfigured(): string {
  return [
    "Todavía no está configurado tu perfil económico real de Cuánto Cobro.",
    "",
    "No voy a calcular ni mostrar un precio con valores de prueba.",
    "",
    "Primero tenemos que completar o conectar tu perfil profesional.",
  ].join("\n");
}

export function textProfileIncomplete(areas: string): string {
  return [
    "Tu perfil todavía está incompleto.",
    `Falta configurar: ${areas}.`,
    "Cuando esté listo, pedime /presupuesto de nuevo.",
  ].join("\n");
}

export function textSyntheticBlocked(): string {
  return "No puedo utilizar un perfil de prueba para darte un presupuesto real.";
}

export function textNoRealBudgetToExplain(): string {
  return "Todavía no hay un presupuesto real para explicar. Primero tenemos que configurar tu perfil económico.";
}

export function textIdentityMismatch(): string {
  return "No pude asociar este chat con el perfil económico del propietario configurado.";
}

export function textBudgetInvalidatedNotice(): string {
  return "Los datos del trabajo están guardados, pero el presupuesto anterior fue invalidado porque utilizó un perfil de prueba.";
}
