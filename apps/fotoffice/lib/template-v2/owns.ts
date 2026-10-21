/**
 * Quién puede abrir cada plantilla del editor. Vive aparte de `server.ts` para poder probarla
 * sola: es la regla que separa el carnet de una institución del fotolibro de un socio.
 */

/**
 * Rol con el que viaja quien diseña **sólo** placas o fotolibros: tiene Comunicación o Ventas
 * en "Gestionar" pero no Socios. Puede abrir y guardar esas plantillas, y ninguna otra —el
 * carnet incluido—. El nombre quedó de cuando sólo existían las placas.
 */
export const ROL_SOLO_PLACAS = "FOTOFFICE_PLACAS_ONLY";

/**
 * Rol del socio que diseña sus fotolibros desde el portal: no tiene panel en la institución, y
 * sólo puede abrir sus plantillas personales (sin institución). No crea plantillas por la API:
 * los fotolibros nacen por `crearFotolibro`. Ver `lib/fotolibro/socio.ts`.
 */
export const ROL_SOCIO_FOTOLIBROS = "FOTOFFICE_SOCIO_FOTOLIBROS";

type Usuario = { id: number; role: string; workspaceId?: string | null };
type Plantilla = { id: string; ownerUserId: number; workspaceId?: string | null };

/**
 * @param permitidas Con `ROL_SOLO_PLACAS`, las plantillas de la institución a las que puede
 *   entrar (placas, fotolibros). Se calculan en cada pedido.
 */
export function puedeAbrirPlantilla(
  user: Usuario,
  template: Plantilla,
  permitidas: ReadonlySet<string> | undefined,
): boolean {
  /*
   * Una plantilla sin institución es personal —un fotolibro que un socio diseña en su portal—:
   * la abre sólo quien la creó, sea cual sea su rol. Y el socio que entra por el portal no abre
   * nada más: ni el carnet ni ninguna plantilla de una institución.
   */
  if (template.workspaceId == null) return template.ownerUserId === user.id;
  if (user.role === ROL_SOCIO_FOTOLIBROS) return false;
  if (user.role === ROL_SOLO_PLACAS) {
    return template.workspaceId === user.workspaceId && (permitidas?.has(template.id) ?? false);
  }
  /*
   * La plantilla es de la institución, no de quien la creó. Si dependiera de la persona, el día
   * que deja la comisión directiva la SFPR perdería su propio carnet.
   */
  return user.workspaceId != null && template.workspaceId === user.workspaceId;
}
