# 14 — BLOQUEANTE DE CUTOVER: la versión de términos apaga la venta de 765 álbumes

**Fecha:** 2026-08-30
**Severidad:** **CRÍTICA — corta el negocio el día 1**
**Encontrado:** recorriendo el sitio desplegado, comparando el mismo álbum en ambos sitios

---

## 1. El síntoma

El mismo álbum público (`prueba-2-b139c336`), mismos datos, misma base:

| Sitio | Botón "Comprar" |
|--|--|
| `www.compramelafoto.com` (legacy) | **presente** |
| `compramelafoto.dnxsuite.com` (monorepo) | **ausente** — *"Las fotos ya están disponibles, pero la venta todavía no fue habilitada por el fotógrafo."* |

---

## 2. La causa

`lib/albums/album-sales-readiness.ts`:

```ts
export function isAlbumTermsAccepted(input) {
  return Boolean(input.termsAcceptedAt) && input.termsVersion === TERMS_VERSION;
}
```

La comparación es por **igualdad exacta** contra la constante compilada en la app:

| | `TERMS_VERSION` |
|--|--|
| Legacy (`lib/terms/photographerTerms.ts`) | `"2026-01-26"` |
| Monorepo (mismo archivo) | `"2026-07-21"` |

`readyToSell` exige `termsOk`, así que con la versión desalineada el álbum nunca llega a
`status: "active"` y la galería pública oculta la compra.

---

## 3. El alcance, medido sobre datos de producción

```sql
SELECT "termsVersion", count(*) AS albumes,
       count(*) FILTER (WHERE "isPublic") AS publicos,
       count(*) FILTER (WHERE "isPublic" AND "enableDigitalPhotos") AS con_venta_digital
FROM "Album" WHERE "termsAcceptedAt" IS NOT NULL GROUP BY 1;
```

| `termsVersion` | Álbumes | Públicos | Con venta digital |
|--|--:|--:|--:|
| `2026-01-26` | **805** | **780** | **765** |

**Una sola versión en toda la base, y es la de legacy.** Cero álbumes con `2026-07-21`.

Traducción: **el día del cutover dejan de venderse 765 álbumes**, hasta que cada fotógrafo
vuelva a aceptar los términos uno por uno.

---

## 4. Por qué no se había visto

La auditoría de julio (`09-legal-human-review.md`) marcó la divergencia de términos como
**LEGAL_BLOQUEANTE** por riesgo contractual — el texto del monorepo (v3, con Info Spot)
difiere del que los fotógrafos aceptaron (v2).

Lo que no se documentó es que la divergencia **además apaga la venta por código**. No es solo
un problema de texto legal: es un interruptor comercial.

Tampoco lo detectaba ninguna prueba: el build pasa, la página responde 200 y la app no
registra ningún error. Solo se ve comparando la misma pantalla en los dos sitios.

---

## 5. Salidas posibles

| Opción | Qué implica |
|--|--|
| **A. Alinear la constante** — volver `TERMS_VERSION` a `2026-01-26` en el monorepo | La venta sigue andando el día 1. Pero entonces el texto v3 (Info Spot) queda publicado sin que nadie lo haya aceptado: **hay que resolver lo legal antes**, no después |
| **B. Backfill** — actualizar `termsVersion` de los 805 álbumes a `2026-07-21` | Los da por aceptados sin que el fotógrafo lo haya hecho. **Riesgo contractual**; requiere decisión del titular |
| **C. Pedir re-aceptación** con un aviso al entrar | Es lo correcto legalmente y ya estaba previsto por el titular. Pero **la venta queda cortada** para cada fotógrafo hasta que entre y acepte |
| **D. Mixta** — alinear la constante para el cutover y pedir la re-aceptación después, de forma escalonada | Sin corte de venta y con el consentimiento buscado. Requiere que el texto publicado el día 1 sea el v2 |

**Decisión del titular.** Ninguna es puramente técnica.

---

## 6. Verificación de la corrección

Cualquiera sea la opción, comprobar antes del cutover:

```bash
# el álbum público debe mostrar el botón de compra
curl -s https://<dominio>/album/<slug> | grep -c "Comprar"
```

Y en la base, que no queden álbumes públicos con venta digital cuya `termsVersion`
difiera de la constante compilada.
