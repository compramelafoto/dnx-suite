/**
 * Cómo se reparte un envío masivo, sin enviar nada.
 *
 * Son dos decisiones que no necesitan una base ni un proveedor de correo —en cuántas tandas se
 * manda, y a quién todavía hay que escribirle— y por eso viven acá, puras y probadas. Enviar es
 * de la acción que llama; esto solo decide el orden.
 */

/**
 * Reparte una lista en tandas de a lo sumo `tamano`.
 *
 * Existe porque el aviso de una convocatoria nueva le habla a todos los colaboradores activos de
 * la institución, y mandar cincuenta correos uno detrás del otro deja a quien apretó «Publicar»
 * esperando quince segundos dentro de una Server Action. En tandas chicas y en paralelo, esa
 * misma espera baja a unos pocos segundos sin abrirle al proveedor cincuenta conexiones de golpe.
 *
 * Un `tamano` de cero o negativo devolvería tandas vacías para siempre —un bucle infinito de
 * llamadas que no manda nada—, así que se trata como uno.
 */
export function enTandas<T>(lista: readonly T[], tamano: number): T[][] {
  const paso = Math.max(1, Math.floor(tamano));
  const salida: T[][] = [];
  for (let i = 0; i < lista.length; i += paso) {
    salida.push(lista.slice(i, i + paso));
  }
  return salida;
}

/**
 * A quiénes todavía hay que escribirles: los destinatarios que no figuran ya avisados.
 *
 * La comparación es por el correo en minúsculas, igual que en `destinatariosDeColaboradores`:
 * dos filas del padrón con la misma dirección escrita distinto son la misma persona, y
 * reenviarle el aviso porque una tiene mayúsculas sería escribirle dos veces.
 *
 * Conserva el orden y la forma original de la lista de destinatarios: lo que se devuelve es lo
 * que va al campo «para», y ahí la dirección tiene que ir como la cargó la institución.
 */
export function pendientesDeAviso(
  destinatarios: readonly string[],
  yaAvisados: ReadonlySet<string>,
): string[] {
  const avisados = new Set([...yaAvisados].map((d) => d.trim().toLowerCase()));
  return destinatarios.filter((d) => !avisados.has(d.trim().toLowerCase()));
}
