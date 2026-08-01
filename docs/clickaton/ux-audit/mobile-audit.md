# Auditoría móvil — Clickatón

**Etapa:** 01 — Solo auditoría  
**Fecha:** 2026-08-01  
**Anchos evaluados (criterio):** 320 · 360 · 375 · 390 · 414 · 430 px  
**Método:** revisión estática de layouts, clases Tailwind y componentes (sin cambiar arquitectura).  
**Errores de experiencia móvil documentados:** 34 hallazgos (28 P0–P2 + 6 P3/notas)

---

## 1. Criterios revisados

- Scroll horizontal involuntario  
- Tablas ilegibles  
- Textos cortados  
- Botones fuera de pantalla / &lt; 44×44 px  
- Modales más altos que el viewport  
- Encabezados densos  
- Menús que bloquean contenido  
- Filtros que no entran  
- Tarjetas densas  
- Columnas que deberían apilarse  
- Teclado que tapa CTAs  
- Diálogos difíciles de cerrar  

**Restricción:** conservar estructura y flujo; solo proponer ajustes responsive dentro de cada pantalla.

---

## 2. Lo que ya funciona bien

| Área | Evidencia |
|---|---|
| Sidebar admin | `hidden lg:block` + drawer móvil (`AdminShell`) |
| Tablas admin genéricas | `AdminDataTable` → cards en `&lt;md` |
| CTAs wizard inscripción | Botones principales `w-full` |
| Modal guía de talles | `max-h-[90vh] overflow-y-auto` |
| Hero maratón | CTAs full-width en mobile |

---

## 3. Hallazgos por severidad

### P0 — bloquea uso u overflow fuerte

| ID | Pantalla / componente | Archivo | Problema | Anchos | Ajuste recomendado (sin nueva arquitectura) |
|---|---|---|---|---|---|
| M-01 | Catálogo · composición entrada | `TicketCompositionPanel.tsx` | Tabla `min-w-[880px]` | 320–430 | Cards mobile (patrón `AdminDataTable`) + hint «deslizá →» si se mantiene scroll |
| M-02 | Catálogo · variantes | `ProductVariantsPanel.tsx` | `min-w-[720px]` | 320–430 | Card por variante; SKU truncado + expand |
| M-03 | Precios · ítems fase | `PricePhaseItemsPanel.tsx` | `min-w-[720px]` + form en colSpan | 320–430 | Lista apilada; editar debajo |
| M-04 | Detalle inscripción · kit | `inscripciones/[registrationId]/page.tsx` | `min-w-[640px]` + form en celda | 320–414 | Card por ítem; acciones fuera de tabla |
| M-05 | Checkout Card Brick | `CardPaymentBrickCheckout.tsx` + `CheckoutPayButton` | SDK suele superar 360px; sin `min-w-0` / overflow | 320–375 | Wrapper `min-w-0 overflow-x-auto` + mensaje; CTA fallback full-width |

### P1 — fricción alta

| ID | Pantalla / componente | Archivo | Problema | Anchos | Ajuste recomendado |
|---|---|---|---|---|---|
| M-06 | Listado inscripciones · filtros | `inscripciones/page.tsx` | ~12 campos + 4 botones | 320–430 | Acordeón «Filtros»; primarios visibles; botones `w-full` |
| M-07 | Listado · cards mobile | `AdminDataTable` + page | Card muestra 14+ columnas | 320–390 | `mobileCard` con 4–5 campos + «Ver más» |
| M-08 | Detalle inscripción · header | page detalle | Badges + muchas acciones `sm` | 320–414 | Stack; menú «Más acciones» |
| M-09 | Finanzas edición · tabla | `finanzas/page.tsx` | Overflow + IDs mono | 320–390 | Cards 1 col; IDs truncados |
| M-10 | Editor distribución | `EditionDistributionEditor.tsx` | Selects + Quitar apretados | 360–430 | «Quitar» full-width; total sticky |
| M-11 | Hub edición · acciones | `EditionDetailActions.tsx` | 4 CTAs + 7 módulos `sm` | 320–430 | Grid 2 cols módulos; CTAs `w-full` |
| M-12 | Botones globales | `Button.tsx` | `whitespace-nowrap` corta labels largos | 320–375 | `whitespace-normal` en admin o labels cortos mobile |
| M-13 | Topbar admin | `AdminTopbar.tsx` | Email + «Cerrar sesión» denso | 320–360 | Logout icon-only; email truncado 1 línea |
| M-14 | Header público | `SiteHeader` + `AccountMenu` | Nombre + login + menú; `min-h-24` | 320–390 | Avatar-only &lt;360; header más bajo |
| M-15 | Wizard inscripción | `PublicRegistrationWizard.tsx` | Stepper pills + resumen largo | 320–430 | «Paso X/4»; resumen colapsable o barra inferior |
| M-16 | Form entrega ítem | `ItemFulfillmentForm.tsx` | Flex wrap sin full-width | 320–414 | `flex-col` + hit ≥44px |
| M-17 | Acreditación dashboard | `acreditacion/page.tsx` | Input+botón wrap; 6 KPIs | 320–430 | Input/botón full-width; KPIs 2 cols |

### P2 — degradación / affordance

| ID | Pantalla / componente | Archivo | Problema | Anchos | Ajuste recomendado |
|---|---|---|---|---|---|
| M-18 | Media productos | `ProductMediaUploadFields.tsx` | Botones `py-1 text-xs` &lt;44px | 320–430 | `min-h-11 min-w-11` |
| M-19 | Nav móvil admin | `AdminMobileNavigation.tsx` | Cerrar `h-9 w-9` | 320–430 | `h-11 w-11` |
| M-20 | Precios · duplicar fase | `PricePhaseItemsPanel.tsx` | `min-w-[14rem]` en fila | 320–360 | `w-full`; botón debajo |
| M-21 | Catálogo hub KPIs | `catalogo/page.tsx` | `grid-cols-2` apretado | 320 | Vigilar; 1 col si crece copy |
| M-22 | Placa · share | `WelcomeCardShareActions.tsx` | Side-by-side no full-width | 320–390 | `flex-col w-full` |
| M-23 | Credencial print | `CredentialPrintActions.tsx` | Idem | 320–375 | Stack full-width |
| M-24 | QR / reenviar | `QrDownloadButton`, `ResendConfirmationButton` | `inline-flex` | 320–414 | `w-full` en contenedores postpago |
| M-25 | Shell admin sticky | `AdminShell` + topbar | Sin `scroll-mt` en headings | 320–430 | `scroll-mt-*` |
| M-26 | Wizard resumen | `PublicRegistrationWizard` | Aside ocupa mucho scroll | 320–430 | Colapsar; CTAs sticky bottom |
| M-27 | Mi inscripción | `mi-cuenta/inscripciones/[id]` | Dashboard muy largo | 320–430 | TOC / secciones colapsables; CTA QR sticky |
| M-28 | Escáner | `AccreditationScanner.tsx` | CTAs no siempre full-width | 320–414 | Primary `w-full`; kit stack |

### P3 — menor / ya mitigado

| ID | Nota |
|---|---|
| M-29 | Documentar `mobileCard` obligatorio en listados densos |
| M-30 | Drawer `w-[min(20rem,88vw)]` OK |
| M-31 | Modal talles OK — mantener focus trap |
| M-32 | `PromptPhotoUpload` — subir `size` del CTA confirmar |
| M-33 | `MarathonHero` OK — vigilar tipografía display en 320 |
| M-34 | Admisión — 9 KPIs en 1 col → scroll largo; agrupar core/extra |

---

## 4. Matriz por pantalla × resolución (síntesis)

| Pantalla | 320 | 360 | 375 | 390 | 414 | 430 | Peor problema |
|---|---|---|---|---|---|---|---|
| Catálogo entradas/productos | ●●● | ●●● | ●● | ●● | ●● | ●● | Tablas min-width |
| Precios edición | ●●● | ●●● | ●● | ●● | ●● | ● | Tabla + form |
| Inscripciones listado | ●●● | ●●● | ●● | ●● | ●● | ● | Filtros + card verbose |
| Inscripción detalle admin | ●●● | ●●● | ●● | ●● | ●● | ● | Kit table + acciones |
| Finanzas / distribución | ●● | ●● | ●● | ● | ● | ● | IDs + overflow |
| Hub edición | ●● | ●● | ●● | ● | ● | ● | Módulos densos |
| Checkout Brick | ●●● | ●●● | ●● | ● | ● | ○ | SDK width |
| Wizard inscripción | ●● | ●● | ●● | ● | ● | ○ | Resumen + stepper |
| Mi cuenta / inscripción | ●● | ●● | ●● | ● | ● | ○ | Longitud + CTAs |
| Acreditación / escáner | ●● | ●● | ● | ● | ○ | ○ | Forms wrap |
| Shell admin / header | ●● | ●● | ● | ● | ○ | ○ | Topbar denso |
| Marketing / formar-parte | ●● | ●● | ● | ○ | ○ | ○ | Tabla `min-w-[52rem]` en JoinLevels |

Leyenda: ●●● crítico · ●● alto · ● medio · ○ leve

---

## 5. Patrones transversales a corregir primero

1. **Tablas con `min-w-[640–880]`** → cards mobile compartidas.  
2. **Filtros densos** → acordeón + 2–3 filtros primarios.  
3. **`mobileCard` reducido** en `AdminDataTable` (API de columnas priority).  
4. **CTAs `w-full` + min 44px** en cuenta, pago, acreditación, media.  
5. **Headers / action clusters** → stack + overflow «Más».  
6. **Contenedor Brick** con overflow controlado.  

---

## 6. Riesgos al implementar responsive

- No romper el patrón desktop de tablas densas (ops necesita columnas).  
- El SDK de Mercado Pago Brick no es controlable al 100%; solo wrap/scroll.  
- Sticky CTAs pueden tapar inputs si no hay `safe-area` / padding inferior.  
- Colapsar resumen del wizard no debe ocultar el total a pagar.  
- No cambiar rutas ni flujo; solo presentación.
