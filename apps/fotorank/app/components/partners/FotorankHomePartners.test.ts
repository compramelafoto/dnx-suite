import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS,
  MOUNTED_WELCOME_PLACEMENT_KEYS,
  UNMOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS,
  UNMOUNTED_WELCOME_PLACEMENT_KEYS,
  canMountPartnerWelcomeActivation,
  isFotorankHomeMarqueeEnabled,
  isFotorankHomeWelcomeEnabled,
} from "@repo/partners";
import {
  FOTORANK_HOME_WELCOME_APPEAR_DELAY_MS,
  FOTORANK_HOME_WELCOME_PLACEMENT,
} from "../../lib/fotorank/partners/home-welcome-shared";
import { FOTORANK_HOME_MARQUEE_PLACEMENT } from "../../lib/fotorank/partners/home-marquee-shared";

const here = dirname(fileURLToPath(import.meta.url));

/** Enciende una variable de entorno solo durante `fn`. */
function conFlag(nombre: string, valor: string | undefined, fn: () => void) {
  const previo = process.env[nombre];
  try {
    if (valor === undefined) delete process.env[nombre];
    else process.env[nombre] = valor;
    fn();
  } finally {
    if (previo === undefined) delete process.env[nombre];
    else process.env[nombre] = previo;
  }
}

describe("FotoRank — inventario global de portada", () => {
  it("las banderas están apagadas por defecto", () => {
    conFlag("FOTORANK_HOME_WELCOME_ENABLED", undefined, () => {
      assert.equal(isFotorankHomeWelcomeEnabled(), false);
    });
    conFlag("FOTORANK_HOME_MARQUEE_ENABLED", undefined, () => {
      assert.equal(isFotorankHomeMarqueeEnabled(), false);
    });
  });

  it("solo 1|true|on|yes encienden; cualquier otra cosa deja apagado", () => {
    for (const v of ["false", "maybe", "0", ""]) {
      conFlag("FOTORANK_HOME_WELCOME_ENABLED", v, () => {
        assert.equal(isFotorankHomeWelcomeEnabled(), false, v);
      });
    }
    for (const v of ["1", "true", "on", "yes", "TRUE"]) {
      conFlag("FOTORANK_HOME_WELCOME_ENABLED", v, () => {
        assert.equal(isFotorankHomeWelcomeEnabled(), true, v);
      });
    }
  });

  it("la placa de portada tiene bandera propia, distinta de la del concurso", () => {
    // Son inventarios de dueños distintos: el concurso es del organizador y la
    // portada de la plataforma. Encender uno no debe encender el otro.
    conFlag("FOTORANK_PARTNER_WELCOME_ENABLED", "true", () => {
      conFlag("FOTORANK_HOME_WELCOME_ENABLED", undefined, () => {
        assert.equal(isFotorankHomeWelcomeEnabled(), false);
      });
    });
  });

  it("la placa de portada solo monta en la raíz", () => {
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "FOTO_RANK",
        placementKey: FOTORANK_HOME_WELCOME_PLACEMENT,
        pathname: "/",
      }).ok,
      true,
    );
    for (const pathname of ["/concursos/uno", "/crear-cuenta", "/dashboard"]) {
      assert.equal(
        canMountPartnerWelcomeActivation({
          application: "FOTO_RANK",
          placementKey: FOTORANK_HOME_WELCOME_PLACEMENT,
          pathname,
        }).ok,
        false,
        pathname,
      );
    }
  });

  it("ambos placements figuran como montados en el panel", () => {
    assert.ok(
      (MOUNTED_WELCOME_PLACEMENT_KEYS as readonly string[]).includes(
        FOTORANK_HOME_WELCOME_PLACEMENT,
      ),
    );
    assert.ok(
      (MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS as readonly string[]).includes(
        FOTORANK_HOME_MARQUEE_PLACEMENT,
      ),
    );
    assert.ok(
      !(UNMOUNTED_WELCOME_PLACEMENT_KEYS as readonly string[]).includes(
        FOTORANK_HOME_WELCOME_PLACEMENT,
      ),
    );
    assert.ok(
      !(UNMOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS as readonly string[]).includes(
        FOTORANK_HOME_MARQUEE_PLACEMENT,
      ),
    );
  });

  it("el delay de aparición es el mismo que el del concurso", () => {
    assert.equal(FOTORANK_HOME_WELCOME_APPEAR_DELAY_MS, 1000);
  });

  it("los cargadores no consultan la base si la bandera está apagada", () => {
    // El corte por bandera va antes de cualquier import de prisma dentro de la
    // función: si alguien lo mueve, esta prueba deja de proteger.
    const welcome = readFileSync(
      join(here, "../../lib/fotorank/partners/home-welcome.ts"),
      "utf8",
    );
    const marquee = readFileSync(
      join(here, "../../lib/fotorank/partners/home-marquee.ts"),
      "utf8",
    );

    assert.match(welcome, /if \(!isFotorankHomeWelcomeEnabled\(\)\) return null;/);
    assert.match(marquee, /if \(!isFotorankHomeMarqueeEnabled\(\)\) return \[\];/);

    // Sin contexto de concurso: la portada nunca puede servir el sponsor de un
    // concurso ajeno. Se mira que no se pase como argumento — mencionarlo en un
    // comentario es legítimo.
    assert.doesNotMatch(welcome, /contestContextId\s*:/);
    assert.doesNotMatch(marquee, /contestContextId\s*:/);
  });

  it("la portada monta los dos componentes", () => {
    const page = readFileSync(join(here, "../../page.tsx"), "utf8");
    assert.match(page, /FotorankHomePartnerWelcome/);
    assert.match(page, /FotorankPartnerLogoMarquee/);
  });
});
