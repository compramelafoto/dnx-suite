import "server-only";
import { credencialesDeVentas, leerConfigDeVentas, type ConfigDeVentas } from "./config";
import { cuentaDelToken } from "./mp";

/**
 * El modo de la venta confirmado contra Mercado Pago (revisión de las tareas 1 a 5). La forma del
 * token no alcanza: en "prueba" el token tiene que ser de un usuario de prueba (`test_user`) y en
 * vivo, no; y la cuenta del token tiene que ser la del `owner` de las Orders. Si algo no cierra, o
 * no se pudo preguntar, la venta queda apagada. Lo usan las acciones que mueven plata (reservar,
 * pagar); los paneles muestran el modo de `leerConfigDeVentas`.
 */
export async function configVerificada(): Promise<ConfigDeVentas> {
  const c = leerConfigDeVentas();
  if (c.modo === "OFF") return c;
  const off = (motivo: string): ConfigDeVentas => ({ ...c, modo: "OFF", motivo });
  const cuenta = await cuentaDelToken();
  if (!cuenta) return off("No pudimos verificar la cuenta de Mercado Pago de la plataforma.");
  if (c.modo === "TEST" && !cuenta.esDePrueba) return off("El token de prueba no es de un usuario de prueba de Mercado Pago.");
  if (c.modo === "LIVE" && cuenta.esDePrueba) return off("El token de producción es de un usuario de prueba de Mercado Pago.");
  if (credencialesDeVentas().ownerUserId !== cuenta.id) return off("MUESTRAS_MP_OWNER_USER_ID no coincide con la cuenta del token de Mercado Pago.");
  return c;
}
