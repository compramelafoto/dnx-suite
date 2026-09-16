import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { getModuleDefinition } from "@/lib/modules/registry";
import { allSubmoduleItems } from "@/lib/modules/submodules";

/**
 * Las frases que la pantalla de palabras muestra como vista previa.
 *
 * **No son frases inventadas para la pantalla: son las del sistema.** Salen del catálogo de
 * módulos y del de submódulos, sin copiarlas. Si mañana alguien reescribe la descripción del
 * módulo, la vista previa muestra la nueva; y si alguien le saca los marcadores, el test de
 * este archivo lo dice antes que un usuario.
 *
 * Existen porque la palabra sola no alcanza para decidir. Quien escribe "voluntario" tiene
 * que poder ver "Todos los voluntarios, su estado y su ficha" antes de guardar, y no
 * enterarse recién al abrir el menú.
 */
export type FraseDeEjemplo = {
  /** Dónde se lee esa frase en el sistema. Sin esto, la vista previa es una lista de frases sueltas. */
  donde: string;
  /** El texto con los marcadores sin resolver. Quien muestra la frase aplica el vocabulario. */
  plantilla: string;
};

/** Un texto sin marcadores no sirve de vista previa: se vería igual escribas lo que escribas. */
function tieneMarcador(texto: string | undefined): texto is string {
  return Boolean(texto && texto.includes("{"));
}

export function frasesDeEjemplo(): FraseDeEjemplo[] {
  const modulo = getModuleDefinition(MEMBERS_MODULE_KEY);
  const cuotas = getModuleDefinition(MEMBERSHIP_DUES_MODULE_KEY);
  const padron = allSubmoduleItems().find((i) => i.href === "/members");

  const candidatas: Array<{ donde: string; plantilla: string | undefined }> = [
    { donde: "En el menú lateral", plantilla: modulo?.label },
    { donde: "En el inicio del workspace", plantilla: modulo?.description },
    { donde: "En las pantallas del módulo", plantilla: padron?.description },
    { donde: "En Cuotas", plantilla: cuotas?.description },
  ];

  return candidatas
    .filter((c): c is FraseDeEjemplo => tieneMarcador(c.plantilla))
    .map((c) => ({ donde: c.donde, plantilla: c.plantilla }));
}
