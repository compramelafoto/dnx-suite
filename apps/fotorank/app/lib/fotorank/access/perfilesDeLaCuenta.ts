import { cache } from "react";
import { prisma } from "@repo/db";

import type { AuthUser } from "../../auth";
import { contarJuradosPendientes } from "../../../actions/judgeDirectoryReview";
import type { PerfilesDeLaCuenta } from "../../../components/shell/menuDeLaCuenta";
import { tieneCuentaDeJurado } from "./judge-panel-access";
import { userIsFotorankSuperAdmin } from "./super-admin";

/**
 * Qué perfiles tiene una cuenta, para armar su menú.
 *
 * Lo consultan los cuatro marcos (hub, organizador, participante y jurado), así
 * que tiene que ser barato: tres conteos y ninguna lista. Es el mismo criterio
 * que usa el hub personal (`resolveHomeCapabilities`), para que una sección no
 * pueda aparecer en un lugar y faltar en otro.
 *
 * Organizador es quien es miembro activo de al menos una organización. El
 * permiso de app (`appAccess`) no alcanza: sin organización, el panel lo manda
 * a crear una, y un menú de seis entradas que terminan todas en ese formulario
 * es peor que no tenerlo.
 *
 * Fail-closed: si una consulta falla, esa sección no aparece. El menú es un
 * atajo, no una puerta: cada pantalla vuelve a decidir quién entra.
 */
export const perfilesDeLaCuenta = cache(async (user: AuthUser): Promise<PerfilesDeLaCuenta> => {
  const esSuperAdmin = userIsFotorankSuperAdmin(user);

  const [esJurado, organizaciones, juradosPorRevisar] = await Promise.all([
    tieneCuentaDeJurado(user.email),
    prisma.contestOrganizationMember
      .count({ where: { userId: user.id, status: "ACTIVE" } })
      .catch((err: unknown) => {
        console.error("FOTORANK MENU ORGANIZER CHECK ERROR", err);
        return 0;
      }),
    esSuperAdmin ? contarJuradosPendientes().catch(() => 0) : Promise.resolve(0),
  ]);

  return {
    esJurado,
    esOrganizador: esSuperAdmin || organizaciones > 0,
    esSuperAdmin,
    juradosPorRevisar,
  };
});
