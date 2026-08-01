# Etapa 02 Imp. 09 — Consistencia global de paneles y navegación

**Estado:** DONE (con residuales y dependencias documentadas)  
**Fecha:** 2026-08-01  
**Alcance:** consolidación transversal de navegación, encabezados, errores, cargas, integraciones y residuals de idioma.  
**No modificado:** rutas, APIs, permisos, Prisma, estados persistidos, pagos, Resend, Meta, jobs, lógica de negocio.

---

## Cantidades

| Métrica | Valor |
|---|---|
| Rutas revisadas (inventario Etapa 01) | **66** páginas base + shells/errores/loading |
| Rutas / superficies modificadas en Imp. 09 | **~28** (nav, dashboard, banners, sponsors, catálogo breadcrumbs, forms labels, errores, loadings, integraciones, config, mobile nav, flash) |
| Rutas sin cambios de código (ya OK o fuera de alcance visual) | Mayoria de módulos Imp. 01–08 |
| Dependientes de FotoRank | Jurado / resultados / evaluación |
| Fuera de alcance justificado | Design-system showcase, legal body, editor escolar |

---

## Navegación

Menú admin humanizado:

- Dashboard → **Inicio**
- Catálogo → **Productos y kits**
- Promociones → **Códigos promocionales**
- Publicaciones en redes → **Publicaciones y comunicaciones**
- Sponsors → **Patrocinadores**
- Banners Home → **Banners del inicio**
- Mi cuenta de cobro → **Finanzas · mi cuenta de cobro**

Breadcrumb raíz: **Inicio** (antes “Admin”).  
Menú móvil: foco Escape, cierre táctil `min-h-11`, `aria-modal`.

## Dashboard

- Título “Inicio del panel”
- Acciones con verbos concretos
- Sin “MVP” / “Dashboard” como copy principal
- Integraciones con estados ya humanizados

## Integraciones / diagnóstico

- Mercado Pago / FotoRank con propósito operativo
- Notas Resend + Instagram sin inventar health falso
- Diagnóstico (Imp. 03/08) conserva operativo + técnico colapsable

## Errores / vacíos / carga

- Acceso denegado y 404 con salidas claras
- `loading.tsx` admin + mi-cuenta
- Flash messages ampliados (cambios, correo, placa)

## Mobile / a11y

- Validación estructural 320–430 documentada en `global-mobile-matrix.md`
- Revisión a11y básica en `global-accessibility-review.md`

## Pruebas

| Suite | Resultado |
|---|---|
| `test:global-ux` | PASS (8) |
| `test:public-ux` … `test:social-communications-ux` | PASS (todas las suites Imp. 01–08) |
| `products-ui.selfcheck` (nav label) | Actualizado a “Productos y kits” |
| ESLint archivos modificados | PASS |
| `npm run build` | PASS |
| E2E | No ejecutados |

## Riesgos pendientes

Ver `human-review-pending.md` y `global-copy-residuals.md`.
