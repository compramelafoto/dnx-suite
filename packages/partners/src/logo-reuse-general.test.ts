import assert from "node:assert/strict";
import test from "node:test";
import {
  canReusePartnerLogoFamilyFromGeneral,
  partnerLogoFamilyMatchesGeneral,
} from "./logo-reuse-general";

test("solo familias distintas de Logo general pueden reutilizar", () => {
  assert.equal(canReusePartnerLogoFamilyFromGeneral("LOGO_GENERAL"), false);
  assert.equal(canReusePartnerLogoFamilyFromGeneral("LOGO_HORIZONTAL"), true);
  assert.equal(canReusePartnerLogoFamilyFromGeneral("ISOTYPE"), true);
});

test("detecta familia que apunta a los mismos archivos que general", () => {
  const assets = [
    {
      type: "LOGO_GENERAL" as const,
      backgroundType: "COLOR",
      storageKey: "partners/1/brand/a.png",
    },
    {
      type: "LOGO_HORIZONTAL" as const,
      backgroundType: "COLOR",
      storageKey: "partners/1/brand/a.png",
      reusedFromGeneral: true,
    },
  ];
  assert.equal(
    partnerLogoFamilyMatchesGeneral({ familyType: "LOGO_HORIZONTAL", assets }),
    true,
  );
  assert.equal(
    partnerLogoFamilyMatchesGeneral({
      familyType: "LOGO_HORIZONTAL",
      assets: [
        assets[0]!,
        {
          type: "LOGO_HORIZONTAL" as const,
          backgroundType: "COLOR",
          storageKey: "partners/1/brand/other.png",
        },
      ],
    }),
    false,
  );
});
