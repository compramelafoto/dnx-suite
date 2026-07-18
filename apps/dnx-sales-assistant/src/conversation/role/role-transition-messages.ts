export function textEnterClientRole(): string {
  return [
    "Perfecto.",
    "",
    "A partir de este momento voy a responder como si estuviera hablando con un cliente real.",
    "",
    "No mostraré información interna.",
    "No explicaré costos.",
    "No mostraré mínimos sostenibles.",
    "",
    "Cuando quieras volver al modo propietario decime:",
    "",
    '"Terminemos la simulación."',
  ].join("\n");
}

export function textExitToOwnerRole(): string {
  return [
    "Volvimos al modo propietario.",
    "",
    "Ahora puedo volver a mostrar información interna y ayudarte a revisar presupuestos.",
  ].join("\n");
}

export function textClientBlocksOwnerCommand(): string {
  return [
    "Estamos en simulación de cliente.",
    "",
    "Acá no muestro presupuestos internos ni mínimos.",
    'Cuando quieras volver, decime: "Terminemos la simulación."',
  ].join("\n");
}
