# Cómo se mide el avance

*2026-09-20.*

Un porcentaje escrito a mano miente a la semana. Este documento define un formato que un
script lee, para que el número salga de los mismos documentos donde se trabaja y no de la
memoria de nadie.

Hoy cada documento inventa su vocabulario: uno dice `YES / PARTIAL / NO`, otro
`IMPLEMENTADO_PARCIAL`, otro tacha con `~~`. Eso no se puede sumar.

## Las dos columnas

**Un trabajo no está terminado porque compile.** Esa es la lección más cara de septiembre:

- Los cinco correos de SubiLaFoto tenían 14 pruebas en verde y **no podían salir nunca**:
  el runtime elegido exigía una lista explícita de destinatarios.
- El perfil de venta estaba "completo" según el backlog y **ningún fotógrafo podía vender**:
  nacía sin precio y sin pantalla para ponerlo.
- El borrado a los 30 días devolvió **500** la primera vez que corrió de verdad.

Ninguna de las tres la habría detectado un tablero de una sola columna. Por eso hay dos:

| Columna | Qué pregunta |
|---|---|
| **Código** | ¿Está escrito, con sus pruebas, y mergeado en `main`? |
| **Producción** | ¿Corrió de verdad, contra la base y los servicios reales, y alguien miró el resultado? |

**El porcentaje que vale es el de producción.** El de código sirve para saber cuánto falta
escribir; el de producción, para saber cuánto falta *creer*.

## Los cuatro estados

| Símbolo | Significa |
|---|---|
| `✅` | Hecho. En producción significa: corrió y se verificó, con evidencia anotada |
| `🟡` | A medias. Hay que decir en la nota qué falta |
| `⬜` | Sin empezar |
| `🚫` | No corresponde, o depende de un tercero que no controlamos |

`🚫` **no cuenta** para el total, ni arriba ni abajo. Una tarea bloqueada por Mercado Pago
no debería bajar el porcentaje de nuestro trabajo, pero tampoco subirlo.

## El formato

En cualquier documento, una tabla precedida por la marca `<!-- avance: NOMBRE DE LA ETAPA -->`:

```markdown
<!-- avance: Etapa 3 — Comercial y proveedores -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| 3.5 | ZIP con manifiesto | ✅ | 🟡 | Armado nunca corrido con un evento real |
| 3.7 | Los cinco correos | ✅ | ✅ | día-1 y día-3 SENT el 17/9 |
```

La columna **Nota** es obligatoria cuando el estado no es `✅`: un `🟡` sin explicación es
un `⬜` disfrazado.

## Cómo se lee el tablero

```bash
node scripts/avance.mjs          # imprime el resumen
node scripts/avance.mjs --escribir   # además actualiza docs/AVANCE.md
```

Un proyecto sin ninguna tabla marcada aparece como **sin medir**, no como 0% ni como 100%.
Es a propósito: no tener el dato es distinto de tener el dato en cero, y confundirlos es
cómo un tablero empieza a mentir.
