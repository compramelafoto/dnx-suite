import { beforeEach, describe, expect, it, vi } from "vitest";

type Reserva = {
  id: string;
  spaceId: string;
  googleEventId: string | null;
  status: string;
  paymentStatus: string;
};

const db = { reservas: [] as Reserva[] };

/**
 * Doble de la base con lo justo para este caso: buscar las reservas activas de un evento y
 * marcarlas canceladas. Lo que se prueba es la regla, no Prisma.
 */
vi.mock("@repo/db", () => ({
  prisma: {
    booking: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const estados = (where.status as { in: string[] }).in;
        return db.reservas.filter(
          (r) =>
            r.spaceId === where.spaceId &&
            r.googleEventId === where.googleEventId &&
            estados.includes(r.status),
        );
      }),
      updateMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => {
        let count = 0;
        for (const r of db.reservas) {
          if (where.id.in.includes(r.id)) {
            r.status = "CANCELLED";
            count += 1;
          }
        }
        return { count };
      }),
    },
  },
}));

const { cancelBookingForDeletedEvent } = await import("./lifecycle");

beforeEach(() => {
  db.reservas = [
    { id: "b1", spaceId: "cowork", googleEventId: "ev1", status: "CONFIRMED", paymentStatus: "NOT_REQUIRED" },
    { id: "b2", spaceId: "cowork", googleEventId: "ev2", status: "CANCELLED", paymentStatus: "NOT_REQUIRED" },
    { id: "b3", spaceId: "estudio", googleEventId: "ev3", status: "CONFIRMED", paymentStatus: "PAID" },
  ];
});

describe("borrar el evento en Google cancela la reserva", () => {
  it("cancela la reserva activa de ese evento", async () => {
    const r = await cancelBookingForDeletedEvent({ spaceId: "cowork", googleEventId: "ev1" });
    expect(r.canceladas).toBe(1);
    expect(db.reservas.find((x) => x.id === "b1")?.status).toBe("CANCELLED");
  });

  it("no toca una reserva de otro espacio con el mismo identificador", async () => {
    // Un id de evento no puede alcanzar el espacio de al lado.
    const r = await cancelBookingForDeletedEvent({ spaceId: "cowork", googleEventId: "ev3" });
    expect(r.canceladas).toBe(0);
    expect(db.reservas.find((x) => x.id === "b3")?.status).toBe("CONFIRMED");
  });

  it("volver a ver el mismo borrado no cambia nada", async () => {
    // Importa: FotoOffice borra sus propios eventos al cancelar y después los lee de vuelta.
    await cancelBookingForDeletedEvent({ spaceId: "cowork", googleEventId: "ev1" });
    const segunda = await cancelBookingForDeletedEvent({ spaceId: "cowork", googleEventId: "ev1" });
    expect(segunda.canceladas).toBe(0);
  });

  it("una reserva ya cancelada no se cuenta de nuevo", async () => {
    const r = await cancelBookingForDeletedEvent({ spaceId: "cowork", googleEventId: "ev2" });
    expect(r.canceladas).toBe(0);
  });

  it("un evento que no es de ninguna reserva no hace nada", async () => {
    const r = await cancelBookingForDeletedEvent({ spaceId: "cowork", googleEventId: "bloqueo-a-mano" });
    expect(r).toEqual({ canceladas: 0, pagadas: 0 });
  });

  it("avisa cuando lo cancelado estaba pago: eso es plata a devolver", async () => {
    const r = await cancelBookingForDeletedEvent({ spaceId: "estudio", googleEventId: "ev3" });
    expect(r.canceladas).toBe(1);
    expect(r.pagadas).toBe(1);
  });
});
