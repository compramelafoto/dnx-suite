# Perfil de precios del workspace (Configuración → Precios)

Fecha: 08/10/2026 · Estado: aprobado por Daniel en chat · Rama: `feat/fotoffice-perfil-precios`

## 1. Para qué

Primer paso del bot de ventas de DNX Estudio: que FOTOFFICE tenga **un perfil de precios propio
por workspace** (el perfil completo de ¿Cuánto Cobro?), editable en **Configuración → Precios**, y
que **Presupuestos** lo use en lugar de pedir un perfil resumido en cada renglón. Después lo va a
leer el bot.

## 2. Cómo está hoy (origin/main, 08/10)

- El motor vive en `packages/cuanto-cobro-core` (`calculateCuantoCobro(profile, quote)`), puro.
- FOTOFFICE **no guarda perfil**: el panel de ¿Cuánto Cobro? del editor de presupuestos pide un
  `PerfilPanel` resumido (gastos personales en un solo número, rubros del negocio, horas,
  reservas, posicionamiento), lo convierte con `perfilAlMotor` y guarda la entrada del motor en el
  ítem (`calculo.entrada = { perfil, presupuesto }`). `ultimoPerfilDelWorkspace` precarga el
  último usado. Sólo quien tiene `veCostos` (configurar) lo ve (R4).
- CLF guarda el perfil completo en `CuantoCobroFinancialProfile.profileData` (1:1 con `User`).
  El de Daniel (userId 79, dnxfotografia@gmail.com, actualizado el 31/08/2026) está completo:
  8 grupos de gastos personales, rubros del negocio, colaboradores, horas y distribución, cámara
  principal, inventario de equipo, reservas y posicionamiento.
- `apps/dnx-sales-assistant` no tiene perfil real (sólo `.example.json`).

## 3. Decisiones

1. **Tabla nueva `FotofficePerfilPrecios`**, una fila por workspace:
   `id`, `workspaceId @unique`, `schemaVersion Int @default(1)`, `profileData Json` (un
   `CuantoCobroProfileInput` completo, mismo formato que CLF), `source String?` (`"manual"` |
   `"clf-import"`), `updatedAt`, `updatedByUserId Int?`. FK a `Workspace` con `ON DELETE CASCADE`.
   No toca tablas existentes. SQL a mano en la base de FOTOFFICE (rama Neon `development`)
   antes de fusionar, con `migrate resolve` (flujo habitual; sin staging).
2. **`lib/precios/perfil.ts`** (servidor): `leerPerfilPrecios(workspaceId)` y
   `guardarPerfilPrecios(ctx, perfil)`. Normaliza con `INITIAL_CUANTO_COBRO_PROFILE` (campos
   faltantes → valores iniciales), valida tamaño (≤ 200 KB, igual que R2) y tipos básicos
   (strings, grupos con ítems). Sin `configurar` no lee ni escribe.
3. **`lib/precios/resumen.ts`** (puro): a partir del perfil calcula el resumen que se muestra
   (necesidad mensual, horas facturables por mes, valor de la hora, costo de la hora, perfil
   completo o qué falta) con las funciones del core (`getProfileMonthlyNeed`,
   `computeMonthlyBillableHours`, `getProfileHourlyRate`, `getProfileCostHour`,
   `getCuantoCobroMissingFields`).
4. **Página `/workspace/configuracion/precios`** (permiso `configurar`; no depende del módulo
   `quotes`). Formulario cliente con secciones:
   - Ingresos: vive sólo de la fotografía, otros ingresos.
   - Gastos personales: grupos con renglones (agregar, renombrar, borrar renglón y grupo).
   - Gastos del negocio: alquiler, software, publicidad; colaboradores y su costo.
   - Tiempo: horas por semana y distribución (cobertura, edición, administración, ventas,
     publicidad, capacitación) en porcentajes que deben sumar 100.
   - Equipo: renovación mensual; cámara principal (nombre, vida útil del obturador, valor de
     reposición, disparos actuales). El `equipmentInventory` se conserva tal cual (no se edita acá;
     se muestra "Inventario de equipo importado: se conserva").
   - Reservas: fondo de emergencia, ahorro.
   - Posicionamiento comercial.
   - Resumen en vivo (columna o tarjeta) con el resultado de `resumen.ts`.
   Server action `guardarPerfilPreciosAction` (datos JSON, no FormData campo a campo). Entrada en
   la portada de Configuración y en el buscador si corresponde.
5. **Presupuestos usa el perfil del workspace**:
   - `editor-datos.ts`: `ultimoPerfilDelWorkspace` se reemplaza por `perfilDelWorkspace(ctx)`, que
     devuelve el `CuantoCobroProfileInput` guardado (o null). Sin `veCostos`, null sin leer.
   - `panel-cuanto-cobro.ts`: el cálculo toma un `CuantoCobroProfileInput` completo
     (`entradaDelPanel(perfil, trabajo, tipo)` ya no convierte desde `PerfilPanel`).
     `PerfilPanel`, `perfilAlMotor`, `perfilDesdeMotor` y `CamposPerfil` se eliminan del panel.
   - **Ítem ya calculado**: se reabre con el perfil guardado en SU cálculo (no cambia de precio
     solo). Si difiere del perfil actual del workspace, el panel avisa y ofrece
     "Recalcular con mi perfil actual".
   - **Ítem nuevo sin perfil en el workspace**: el panel no calcula y muestra un enlace a
     Configuración → Precios.
   - El servidor sigue recalculando desde `calculo.entrada` al guardar (R2 intacto).
   - El asistente "Armar con ¿Cuánto Cobro?" usa el mismo perfil del workspace.
6. **Importación del perfil de Daniel**: un script de una sola vez
   (`apps/fotoffice/scripts/importar-perfil-precios-clf.ts`) que lee el perfil de CLF por
   `DATABASE_URL_CLF` + email, y escribe en FOTOFFICE por `DATABASE_URL` + slug de workspace
   (`dnxestudio`), con `source = "clf-import"`. Por defecto sólo muestra qué haría (`--aplicar`
   para escribir); nunca pisa un perfil existente sin `--pisar`. No imprime montos. Lo corre
   Daniel (o Claude con su autorización) después de aplicar el SQL.

## 4. Fuera de alcance

- Plantillas de servicios del bot viejo (casamiento, XV, etc.): van con el bot, sobre las
  propuestas modelo por categoría.
- Editar el inventario detallado de equipo.
- Cambiar el ¿Cuánto Cobro? público de CLF.
- Varias monedas: el perfil queda en ARS.

## 5. Errores y bordes

- Perfil con forma inválida en la base (JSON roto o de otra versión): se normaliza con los valores
  iniciales; si no es un objeto, se trata como "sin perfil".
- Distribución que no suma 100: el formulario no deja guardar y lo explica.
- Montos: se aceptan con el parser del core (`parseCuantoCobroAmount`: puntos y comas).
- Permisos: sólo `configurar` ve la página y los números; el panel de presupuestos para quien no
  tiene `veCostos` queda como hoy.

## 6. Pruebas

- Unitarias: normalización y validación del perfil (`perfil.ts` con prisma simulado), resumen
  (`resumen.ts`), panel con perfil completo (`panel-cuanto-cobro.test.ts` adaptado), editor-datos
  (`perfilDelWorkspace`, sin permiso no lee), action de la página (permiso, datos inválidos),
  script en seco (no escribe sin `--aplicar`, no pisa sin `--pisar`).
- Typecheck y build de FOTOFFICE.
- En navegador con `next dev --webpack` contra una rama Neon de prueba hija de `development`:
  cargar perfil, ver resumen, armar un renglón calculado, reabrirlo.
