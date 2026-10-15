# Etapa A · El precio completo — plan de implementación

- **Spec:** `docs/superpowers/specs/2026-10-15-presupuesto-a-caja-y-estudio-design.md` (§3, aprobada el 15/10/2026).
- **Base:** `origin/main` con las PR 598 y 599 fusionadas.
- **Regla de oro:** con los campos nuevos vacíos, el motor da **exactamente** lo mismo que hoy (core, CLF, asistente de
  ventas). El desglose nuevo (`priceBuildUp`) sólo aparece cuando hay algo encendido.
- **Sin SQL:** el perfil vive en JSON (`FotofficePerfilPrecios.profileData`, `CuantoCobroFinancialProfile.profileData`) y el
  trabajo en la entrada del motor guardada en el ítem (`calculo.entrada`). La política de cancelación se guarda en el
  perfil (JSON) en esta etapa; la etapa B la compone dentro de las condiciones.

## Decisiones de implementación (dentro de lo aprobado)

1. **Un solo bloque opcional en el perfil:** `pricingExtras?: CuantoCobroPricingExtras` (impuestos, cobro, seña, recargos,
   viáticos, seguro, retoque, inflación, mínimo, cancelación, feriados propios). Y uno en el trabajo:
   `jobAdjustments?: CuantoCobroJobAdjustments` (fecha del evento, fecha del cálculo, exprés, km o zona, seguro del evento,
   fotos a retocar, incluir comisión).
2. **Monotributo y seguro anual ÷ 12** suman a la necesidad mensual (valor hora), sólo si están cargados.
3. **Feriados:** por regla de la Ley 27.399 (inamovibles, trasladables al lunes, Carnaval y Viernes Santo por la fecha de
   Pascua) + tabla de excepciones por año (días no laborables con fines turísticos 2026: 23/3, 10/7 y 7/12, Decreto
   614/2025; no llevan recargo de feriado). Más fechas propias del perfil.
4. **Por renglón y por trabajo.** FOTOFFICE corre el motor una vez por concepto. Los factores (recargo por día, exprés,
   inflación, impuestos, comisión, redondeo) se aplican en cada corrida. Lo que es **una vez por trabajo** (viáticos,
   seguro del evento, retoque) va sólo en la **primera** corrida, como ya pasa con las horas con el cliente. La seña, el
   piso y "lo que te queda" se suman a nivel trabajo con `summarizeJobPricing`.
5. **Redondeo:** hacia arriba a $100, por renglón (así los renglones suman el total).
6. **Inflación:** el saldo (total − seña) se cobra en el mes del evento: `saldo × ((1 + i)^meses − 1)`; meses de calendario
   entre la fecha del cálculo y la del evento. Sin fecha del cálculo, no hay ajuste (el motor no lee el reloj).
7. **IVA (responsable inscripto):** se calcula y se muestra en el desglose; el renglón del presupuesto queda **sin IVA**
   (los totales del presupuesto suman IVA en la etapa B).
8. **Margen del renglón** con extras = precio × (1 − IIBB − comisión·(1+IVA)) − costo (costo = costo base del motor + viáticos
   + seguro del evento + retoque).

## Tareas (TDD: prueba que falla → código → prueba en verde)

### Core (`packages/cuanto-cobro-core`)

| # | Prueba | Código |
|---|---|---|
| A1 | `src/pricing-extras/holidays.test.ts`: Pascua 2026 = 5/4; Carnaval 16 y 17/2/2026; Güemes 2026 → 15/6; Soberanía 2026 → 23/11; 12/10/2026 lunes queda; 23/3/2026 es no laborable (no feriado); `eventDayType` de sábado, domingo, feriado y fecha propia | `src/pricing-extras/holidays.ts` |
| A2 | `src/pricing-extras/travel.test.ts`: por km con km libres e ida y vuelta; por zonas (primera que cubre, ninguna → última + aviso); distancia desde coordenadas (línea recta × 1,3) | `src/pricing-extras/travel.ts` |
| A3 | `src/pricing-extras/price-build-up.test.ts`: recargo = mayor de sábado/domingo/feriado + exprés, sólo sobre la parte de servicios propios; gross-up monotributo `N/(1−t−c)` y RI `N/(1−t−c(1+v))` + IVA aparte; comisión apagada por trabajo; redondeo a $100 hacia arriba; seña y saldo; inflación sólo sobre el saldo; hora extra; piso con aviso; descuento sugerido por transferencia = comisión; "lo que te queda" | `src/pricing-extras/price-build-up.ts` |
| A4 | `src/pricing-extras/summarize.test.ts`: suma de varios renglones, seña y piso del trabajo | `src/pricing-extras/summarize.ts` |
| A5 | `src/pricing-extras/backward-compat.test.ts`: con los fixtures de caracterización, el resultado no trae `priceBuildUp` y es idéntico con `pricingExtras` vacío; monotributo + seguro suben el valor hora | `src/types.ts` (tipos e iniciales), `src/hourly-rates.ts`, `src/calculate-cuanto-cobro.ts`, `src/index.ts`, `package.json` (exports) |

### FOTOFFICE

| # | Prueba | Código |
|---|---|---|
| A6 | `lib/precios/perfil-datos.test.ts`: normaliza `pricingExtras` (zonas, fechas, tipos), rechaza % fuera de 0–100 y montos inválidos | `lib/precios/perfil-datos.ts` |
| A7 | `lib/presupuestos/calculo-cuanto-cobro.test.ts`: con extras el renglón toma `priceWithoutVat`, el costo suma viáticos y el margen descuenta impuestos; sin extras, igual que antes | `lib/presupuestos/calculo-cuanto-cobro.ts`, `lib/presupuestos/constantes.ts` (`InstantaneaCalculo.desglose?`) |
| A8 | `lib/presupuestos/panel-cuanto-cobro.test.ts`: `TrabajoPanel` con fecha, exprés, km/zona, seguro del evento y fotos; `trabajoAlMotor` arma `jobAdjustments`; `armarItemsDelAsistente` manda lo de una vez sólo al primero; `trabajoDesdeMotor` lo reabre | `lib/presupuestos/panel-cuanto-cobro.ts` |
| A9 | (UI) Configuración → Precios: paso "Impuestos, cobros y recargos" | `app/workspace/configuracion/precios/secciones-cobros.tsx`, `perfil-form.tsx` |
| A10 | (UI) Panel del presupuesto: campos del trabajo y desglose | `components/presupuestos/panel-cuanto-cobro.tsx`, `components/presupuestos/desglose-precio.tsx` |

### DNX Bot

| # | Prueba | Código |
|---|---|---|
| A11 | `lib/dnx-bot/motor.test.ts`: el parche `cobros` aplica impuestos, comisión, seña, recargos, viáticos, seguro, retoque, inflación, mínimo y cancelación; `cambiosEntre` los lista; `borrador.ts` los fusiona | `lib/dnx-bot/motor.ts`, `lib/dnx-bot/borrador.ts` |
| A12 | `lib/dnx-bot/motor-trabajo.test.ts`: `cotizar` con `ajustes` (domingo, 40 km, exprés, retoque) arma el desglose, la seña y la hora extra en la tarjeta; sin ajustes ni extras, igual que antes | `lib/dnx-bot/motor-trabajo.ts` |
| A13 | `lib/dnx-bot/guia/index.test.ts`: la guía nombra fecha y lugar, feriados, desglose, seña y hora extra | `lib/dnx-bot/guia/cotizar.ts`, `lib/dnx-bot/guia/perfil.ts` |
| A14 | `lib/dnx-bot/evals/escenarios.test.ts`: cuatro escenarios nuevos (domingo con viaje, RI con IVA, bajo el mínimo, evento a 6 meses). **No se corren** (gastan API) | `lib/dnx-bot/evals/escenarios.ts` |

## Verificación

- `pnpm --filter @repo/cuanto-cobro-core test` y `typecheck`.
- FOTOFFICE: `pnpm --filter fotoffice test` y `check-types` con `NODE_OPTIONS=--max-old-space-size=8192`.
- CLF: `test:bot`, pruebas de ¿Cuánto Cobro? (caracterización) y `check-types` con 8 GB.
- `pnpm --filter dnx-sales-assistant test`.
- `@repo/dnx-bot`: no se toca.

## Fuera de esta etapa

Seña cobrada al aceptar, IVA en los totales del presupuesto, lector de IPC en FOTOFFICE (la tasa se carga a mano),
política de cancelación dentro de las condiciones (etapa B).
