/**
 * Cambiar el correo de la cuenta obliga a volver a verificar la identidad (portal de equipos).
 *
 * Se marca `reverifyRequiredAt` dentro de la misma transacción que cambia `User.email`. Si la
 * persona no tiene fila de identidad no pasa nada: `updateMany` no encuentra qué actualizar.
 */

type TxConIdentidad = {
  identityVerification: {
    updateMany(args: {
      where: { userId: number };
      data: { reverifyRequiredAt: Date };
    }): Promise<{ count: number }>;
  };
};

export async function exigirReverificacionDeIdentidad(
  tx: TxConIdentidad,
  userId: number,
  ahora: Date = new Date(),
): Promise<void> {
  await tx.identityVerification.updateMany({
    where: { userId },
    data: { reverifyRequiredAt: ahora },
  });
}
