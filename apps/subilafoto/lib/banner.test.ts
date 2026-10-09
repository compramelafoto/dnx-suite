import { describe, expect, test } from "vitest";
import { enlaceDeBannerValido } from "./banner";

describe("a dónde puede llevar el banner", () => {
  test("a un sitio con https", () => {
    expect(enlaceDeBannerValido("https://instagram.com/mifoto")).toBe(
      "https://instagram.com/mifoto",
    );
  });

  test("a un WhatsApp", () => {
    expect(enlaceDeBannerValido("https://wa.me/5493411234567")).toBe(
      "https://wa.me/5493411234567",
    );
  });

  test("sin enlace también vale: el banner puede ser sólo una imagen", () => {
    expect(enlaceDeBannerValido("")).toBeNull();
    expect(enlaceDeBannerValido("   ")).toBeNull();
    expect(enlaceDeBannerValido(null)).toBeNull();
  });

  test("`http` a secas no", () => {
    /*
      La página del invitado se sirve por https. Un enlace `http` lo bloquea el navegador
      o avisa que el sitio no es seguro, justo arriba del banner del fotógrafo.
    */
    expect(enlaceDeBannerValido("http://misitio.com")).toBeNull();
  });

  test("`javascript:` no, de ninguna forma", () => {
    /*
      Esto termina en el `href` de un enlace que tocan los invitados. Un `javascript:`
      ahí es código ejecutándose en el teléfono de cada persona de la fiesta.
    */
    expect(enlaceDeBannerValido("javascript:alert(1)")).toBeNull();
    expect(enlaceDeBannerValido("JaVaScRiPt:alert(1)")).toBeNull();
    expect(enlaceDeBannerValido("  javascript:alert(1)  ")).toBeNull();
  });

  test("`data:` tampoco", () => {
    expect(enlaceDeBannerValido("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  test("un texto que no es una dirección, no", () => {
    expect(enlaceDeBannerValido("mi instagram es @foto")).toBeNull();
    expect(enlaceDeBannerValido("instagram.com/mifoto")).toBeNull();
  });

  test("se recortan los espacios de los bordes", () => {
    expect(enlaceDeBannerValido("  https://misitio.com  ")).toBe("https://misitio.com");
  });
});
