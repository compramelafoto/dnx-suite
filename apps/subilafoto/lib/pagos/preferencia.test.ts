import { describe, expect, test } from "vitest";
import { armarPreferencia } from "./preferencia";

const BASE = {
  titulo: "Casamiento de Ana y Luis",
  montoCents: 100_000,
  comisionCents: 15_000,
  ordenId: "orden-1",
  compradorEmail: "ana@ejemplo.com",
  compradorNombre: "Ana",
  base: "https://subilafoto.com",
};

describe("la preferencia que se manda a Mercado Pago", () => {
  test("el precio va en pesos, no en centavos", () => {
    // Mercado Pago espera unidades, no centavos. Mandar 100000 en vez de 1000
    // es cobrar cien veces de más, y se descubre con el primer cliente.
    const p = armarPreferencia(BASE);
    expect(p.items[0]!.unit_price).toBe(1000);
    expect(p.items[0]!.quantity).toBe(1);
  });

  test("la comisión de la plataforma viaja como marketplace_fee, también en pesos", () => {
    expect(armarPreferencia(BASE).marketplace_fee).toBe(150);
  });

  test("los centavos no se pierden al convertir", () => {
    const p = armarPreferencia({ ...BASE, montoCents: 99_999, comisionCents: 15_000 });
    expect(p.items[0]!.unit_price).toBe(999.99);
  });

  test("lleva la referencia de la orden, que es como el webhook la encuentra", () => {
    expect(armarPreferencia(BASE).external_reference).toBe("orden-1");
  });

  test("las vueltas apuntan a nuestro dominio", () => {
    const p = armarPreferencia(BASE);
    expect(p.back_urls.success).toContain("https://subilafoto.com/");
    expect(p.back_urls.failure).toContain("https://subilafoto.com/");
    expect(p.notification_url).toContain("https://subilafoto.com/");
  });

  test("una comisión mayor que el monto no se acepta", () => {
    expect(() => armarPreferencia({ ...BASE, comisionCents: 200_000 })).toThrow();
  });

  test("un monto de cero no se acepta", () => {
    expect(() => armarPreferencia({ ...BASE, montoCents: 0 })).toThrow();
  });
});
