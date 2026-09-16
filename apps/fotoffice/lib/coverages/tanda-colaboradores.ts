import { perfilHabilitado, vigenteEnElPadron } from "./colaboradores";

/**
 * Habilitar (o quitar) colaboradores de a muchos.
 *
 * El caso que lo trajo: una institución importa ochenta y pico de voluntarios al padrón y
 * ninguno tiene el perfil de colaborador encendido. Sin ese perfil, quien entra al portal lee
 * "todavía no estás habilitado para anotarte" y no ve una sola convocatoria. Encenderlos de a
 * uno son ochenta y cuatro idas y vueltas antes de poder probar nada.
 *
 * Todo lo que hay acá es puro: decide QUÉ hay que escribir y QUÉ contar, sin tocar la base. La
 * escritura en sí vive en `repository.ts` (`setCollaboratorProfilesActive`) y el permiso, en la
 * acción. Así la parte difícil —a quién se saltea, quién ya estaba, qué se le dice a quien
 * coordina— se puede probar sin una base de datos.
 *
 * **Lo que esta tanda NO hace, a propósito:**
 * - No toca ningún campo del perfil que no sea `active`. Zonas, ciudad, transporte, equipo,
 *   especialidades, radio y notas son datos que alguien cargó a mano; una tanda que pasara el
 *   formulario entero se los borraría a todo el mundo de una sola vez.
 * - No borra filas. "Quitar" apaga el perfil. Borrarlo perdería esos mismos datos, y volver a
 *   habilitar a esa persona significaría cargarlos de nuevo.
 */

/**
 * Cuántos se pueden tocar de una vez.
 *
 * No es un límite de la base —es una sola escritura agrupada, le da igual el tamaño— sino del
 * viaje: los identificadores vienen del navegador, uno por casilla marcada, y un pedido sin
 * techo es un pedido que alguien puede inflar. 500 deja cómodo cualquier padrón real de una
 * institución de voluntariado y el "seleccionar todos" nunca choca contra él.
 */
export const TANDA_COLABORADORES_MAX = 500;

export type AccionDeTanda = "habilitar" | "quitar";

/** Un socio del padrón, tal como lo devuelve `listCollaborators`, para planificar la tanda. */
export type SocioParaLaTanda = {
  id: string;
  status: string | null | undefined;
  coverageProfile: { active: boolean } | null | undefined;
};

export type PlanDeTanda = {
  accion: AccionDeTanda;
  /** Socios que ya tienen fila de perfil y hay que cambiarles `active`. Van en un `updateMany`. */
  actualizar: string[];
  /** Socios sin fila de perfil, a los que hay que crearles una encendida. Van en un `createMany`. */
  crear: string[];
  /** Ya estaban como se pedía. No se tocan y no cuentan como cambio (la tanda es idempotente). */
  sinCambio: number;
  /** Seleccionados que no se habilitan porque no están vigentes en el padrón. */
  fueraDelPadron: number;
  /** Seleccionados que no aparecen en el padrón de este workspace. */
  desconocidos: number;
};

/**
 * Qué escribir y qué contar, a partir de lo seleccionado y del padrón que ya se leyó.
 *
 * `padron` tiene que venir de una consulta acotada a ESTE workspace: los identificadores llegan
 * del navegador y acá se cotejan contra esa lista, así que uno de otra institución cae en
 * `desconocidos` y nunca llega a la escritura. La escritura vuelve a comprobarlo igual, dentro
 * de su propia transacción — esto es la primera barrera, no la única.
 *
 * Repetidos: se descartan. Marcar dos veces a la misma persona no la cuenta dos veces.
 *
 * **Al habilitar, quien no está vigente en el padrón se saltea.** No es un detalle de prolijidad:
 * `participaDeCoberturas` exige las dos cosas —perfil encendido y socio vigente—, así que
 * encenderle el perfil a quien se dio de baja no lo deja participar de nada. Sería prometer algo
 * que el sistema después no cumple, y encima en silencio.
 *
 * **Al quitar, en cambio, el padrón no se mira.** Apagarle el perfil a alguien que ya no está en
 * la institución es exactamente lo que se quiere poder hacer.
 */
export function planificarTandaDeColaboradores(input: {
  accion: AccionDeTanda;
  seleccionados: readonly string[];
  padron: readonly SocioParaLaTanda[];
}): PlanDeTanda {
  const porId = new Map(input.padron.map((s) => [s.id, s]));
  const plan: PlanDeTanda = {
    accion: input.accion,
    actualizar: [],
    crear: [],
    sinCambio: 0,
    fueraDelPadron: 0,
    desconocidos: 0,
  };

  for (const memberId of new Set(input.seleccionados)) {
    const socio = porId.get(memberId);
    if (!socio) {
      plan.desconocidos += 1;
      continue;
    }

    const habilitado = perfilHabilitado(socio.coverageProfile);

    if (input.accion === "habilitar") {
      if (!vigenteEnElPadron(socio.status)) {
        plan.fueraDelPadron += 1;
        continue;
      }
      if (habilitado) {
        plan.sinCambio += 1;
        continue;
      }
      // Sin perfil hay que crear la fila; con el perfil apagado alcanza con encenderlo, y así se
      // conserva todo lo que esa persona ya tenía cargado.
      if (socio.coverageProfile) plan.actualizar.push(memberId);
      else plan.crear.push(memberId);
      continue;
    }

    // Quitar. A quien nunca tuvo perfil no se le crea uno apagado: ya está fuera, y una fila
    // vacía no agrega nada salvo ruido en el padrón de colaboradores.
    if (habilitado) plan.actualizar.push(memberId);
    else plan.sinCambio += 1;
  }

  return plan;
}

/**
 * Qué decirle a quien coordina, en números reales.
 *
 * Un "listo" genérico después de tocar ochenta y cuatro personas no dice nada: ni cuántas
 * cambiaron, ni cuántas ya estaban, ni —sobre todo— que a tres no se las habilitó y por qué. Esa
 * última frase es la que evita que alguien se quede esperando que se anoten personas que el
 * sistema nunca les va a mostrar la convocatoria.
 *
 * `cambiados` es lo que la base dijo que efectivamente escribió, no lo que el plan pensaba
 * escribir: entre una cosa y la otra está la comprobación de workspace de la transacción.
 */
export function describirTanda(input: {
  accion: AccionDeTanda;
  cambiados: number;
  sinCambio: number;
  fueraDelPadron: number;
  desconocidos: number;
}): string {
  const partes: string[] = [];

  if (input.accion === "habilitar") {
    partes.push(input.cambiados === 0 ? "No habilitamos a nadie nuevo." : `Habilitamos ${input.cambiados}.`);
    if (input.sinCambio > 0) {
      partes.push(
        input.sinCambio === 1
          ? "Otro ya estaba habilitado."
          : `Otros ${input.sinCambio} ya estaban habilitados.`,
      );
    }
    if (input.fueraDelPadron > 0) {
      partes.push(
        input.fueraDelPadron === 1
          ? "1 no se habilitó porque no está activo en el padrón."
          : `${input.fueraDelPadron} no se habilitaron porque no están activos en el padrón.`,
      );
    }
  } else {
    partes.push(input.cambiados === 0 ? "No quitamos a nadie." : `Quitamos a ${input.cambiados}.`);
    if (input.sinCambio > 0) {
      partes.push(
        input.sinCambio === 1 ? "Otro ya estaba fuera." : `Otros ${input.sinCambio} ya estaban fuera.`,
      );
    }
  }

  if (input.desconocidos > 0) {
    partes.push(
      input.desconocidos === 1
        ? "1 quedó afuera porque ya no está en el padrón."
        : `${input.desconocidos} quedaron afuera porque ya no están en el padrón.`,
    );
  }

  return partes.join(" ");
}
