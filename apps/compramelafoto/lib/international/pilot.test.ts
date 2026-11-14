import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parsePilotUserIds,
  isIntlPilotUser,
  currencyForMpSite,
  INTL_COMMISSION_PERCENT,
  ADVANCE_USD_CENTS,
  MIN_TOPUP_USD_CENTS,
  TOPUP_OPTIONS_USD_CENTS,
  LOW_BALANCE_USD_CENTS,
} from "./pilot";

test("lista del piloto: ignora basura y vacíos", () => {
  assert.deepEqual([...parsePilotUserIds(" 1038, x ,5,,")].sort((a, b) => a - b), [5, 1038]);
  assert.equal(parsePilotUserIds(undefined).size, 0);
  assert.equal(parsePilotUserIds("").size, 0);
});
test("isIntlPilotUser: solo ids de la lista", () => {
  assert.equal(isIntlPilotUser(1038, { CLF_INTL_PILOT_USER_IDS: "1038" }), true);
  assert.equal(isIntlPilotUser(1038, {}), false);
  assert.equal(isIntlPilotUser(null, { CLF_INTL_PILOT_USER_IDS: "1038" }), false);
  assert.equal(isIntlPilotUser(7, { CLF_INTL_PILOT_USER_IDS: "1038" }), false);
});
test("moneda por sitio de Mercado Pago", () => {
  assert.equal(currencyForMpSite("MCO"), "COP");
  assert.equal(currencyForMpSite("MLC"), "CLP");
  assert.equal(currencyForMpSite("MLM"), "MXN");
  assert.equal(currencyForMpSite("MPE"), "PEN");
  assert.equal(currencyForMpSite("MLU"), "UYU");
  assert.equal(currencyForMpSite("MLB"), "BRL");
  assert.equal(currencyForMpSite("MLA"), null);
  assert.equal(currencyForMpSite(null), null);
});
test("constantes del piloto (decisión del dueño 14/11)", () => {
  assert.equal(INTL_COMMISSION_PERCENT, 15);
  assert.equal(ADVANCE_USD_CENTS, 2500);
  assert.equal(MIN_TOPUP_USD_CENTS, 1000);
  assert.deepEqual([...TOPUP_OPTIONS_USD_CENTS], [2500, 5000, 10000]);
  assert.equal(LOW_BALANCE_USD_CENTS, 500);
});
