# Módulo de diseño de DNX Suite

**Fecha:** 2026-08-26
**Estado:** diseño, pendiente de aprobación
**Primer consumidor:** carnet de socio (FotoOffice)

---

## 1. Objetivo

Un paquete compartido donde se diseñe **cualquier pieza gráfica con datos variables** de la
plataforma —carnets, diplomas, credenciales, placas para redes, fotolibros— y del que salga
el **archivo final**: PDF para imprimir, PNG o JPG para pantalla.

## 2. Por qué existe

Hoy hay **tres motores de diseño** resolviendo el mismo problema, sin compartir una línea:

| Motor | Dónde | Tamaño | Fuerte en |
|---|---|---|---|
| Diplomas | fotorank | ~12.400 líneas | Variables, verificación por token, catálogo |
| Fotolibros | compramelafoto | ~2.300 + componentes | Impresión: 300 DPI, sangrado, área segura |
| `media-composition` | **paquete compartido** | 918 líneas | Interpolar variables, renderizar SVG → imagen |

Cada producto nuevo suma otro. El carnet sería el cuarto.

## 3. Estrategia: estrangulamiento progresivo

El módulo **nace en el paquete compartido**, no en una aplicación. Su primer consumidor es
el carnet —código nuevo, sin riesgo—. Los demás migran de a uno, y **cada motor viejo se
borra cuando su producto ya migró**.

No se copia con promesa de extraer después: esa segunda parte no ocurre casi nunca.

**Orden previsto:** carnet (nuevo) → diplomas → placas → fotolibros. Fotorank está en
producción emitiendo diplomas; migra cuando el paquete esté probado, no antes.

### La disciplina que evita el pantano

> **Abstraer solo donde hay dos casos reales hoy. Para los futuros, dejar lugar — no implementación.**

Hoy hay dos formatos reales: **tarjeta de dos caras** (85,6 × 54 mm, impresa) y **hoja A4**
(diploma). Esa es presión suficiente para que la abstracción sea honesta.

Para historias de Instagram o pliegos de fotolibro se deja el lugar en el modelo, y se
escribe el soporte **cuando ese producto migre y diga qué necesita**. Escribir hoy lo que se
imagina que va a necesitar produce una abstracción equivocada que además estorba.

## 4. Arquitectura: tres capas

| Capa | Responsabilidad | De dónde sale |
|---|---|---|
| **Documento** | Formato, caras, bloques, variables | Nueva, sembrada del esquema de diplomas |
| **Renderizado** | Documento + datos → SVG → PDF/PNG | **Ya existe** en `media-composition` |
| **Editor** | Interfaz para armar el documento | Sembrada del editor de diplomas |

**Que estén separadas no es prolijidad.** El renderizado tiene que funcionar **sin editor**:
la Secretaría aprueba cuarenta socios de una vez y los carnets se emiten en un proceso
automático, sin que nadie abra una pantalla. Y al revés, el editor evoluciona sin tocar cómo
se generaron los archivos ya emitidos.

### Por qué SVG

`media-composition` ya renderiza SVG y lo convierte con `sharp`. SVG resuelve el problema de
los cuatro formatos de una sola vez:

- **Independiente de la resolución** — el mismo diseño sale a 300 DPI para imprenta o a
  1080 px para Instagram
- Maneja texto, imágenes, formas y **QR** (que es SVG por naturaleza)
- Convierte a **PDF** y a **PNG/JPG** desde la misma fuente

No hay que elegir entre pantalla e impresión al diseñar: se elige **al exportar**.

## 5. El documento

Se siembra del esquema de diplomas (`layoutSchema.ts`, 359 líneas), que ya resolvió bien:

- Cinco tipos de bloque: `text`, `qrcode`, `image`, `line`, `rect`
- Posición, tamaño, rotación, opacidad
- Capas con nombre, bloqueo y visibilidad
- Variables por marcadores `{{clave}}`

### Lo que se agrega

**Formato como concepto de primera clase.** Hoy el diploma asume una hoja. El documento
pasa a declarar:

```
formato:
  ancho, alto          en milímetros (impresión) o píxeles (pantalla)
  medio                PRINT | SCREEN
  dpi                  solo PRINT
  sangrado, área segura  solo PRINT
caras: [ cara1, cara2… ]   cada una con sus bloques
```

El **medio** decide las unidades y qué guías se dibujan. Un carnet impreso necesita sangrado
y área segura; una placa de Instagram no tiene ninguno de los dos.

**Varias caras.** El diploma tiene una; el carnet, dos. Es un arreglo, no un campo nuevo por
cara: así el fotolibro —que tiene muchas— entra después sin rediseñar.

**Variables declaradas por el consumidor.** Hoy `DIPLOMA_VARIABLE_KEYS` está fijo en el
código. Pasa a ser un **catálogo que declara quien usa el módulo**: el carnet declara
`memberNumber`, `fullName`, `categoryName`, `validUntil`, `photoUrl`, `verificationUrl`; el
diploma sigue declarando las suyas. El editor ofrece las del catálogo activo.

**Tamaño mínimo del QR.** Por debajo de cierta medida física un QR deja de escanear. Es un
límite duro que ningún motor actual conoce, y el carnet lo necesita: en 85,6 × 54 mm es fácil
poner un QR ilegible sin darse cuenta.

## 6. Lo que el módulo NO hace

| Fuera | Por qué |
|---|---|
| Emitir | Quién recibe qué y cuándo es del producto, no del diseñador |
| Verificar | La página pública del QR es del producto: sabe qué significa "habilitado" |
| Guardar los archivos | El almacenamiento ya está resuelto (R2) |
| Formatos de fotolibro y redes | Se agregan cuando esos productos migren |

El módulo diseña y renderiza. **Qué se emite y qué significa es del producto.**

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Abstracción prematura por imaginar formatos futuros | Solo se implementan los dos formatos reales de hoy |
| Migrar fotorank rompe diplomas en producción | Fotorank migra último, con el paquete ya probado por el carnet |
| Quedan cuatro motores en vez de tres | Cada motor viejo se borra cuando su producto migra; si no se borra, no se terminó |
| El editor se lleva puesto el renderizado | Capas separadas: el renderizado no importa nada del editor |

## 8. Decisiones abiertas

| # | Decisión | Recomendación |
|---|---|---|
| 1 | ¿El editor arranca con `react-rnd` (diplomas) o `CanvasEditor` (fotolibros)? | **`react-rnd`**: viene con el motor que sembramos y ya soporta variables. Lo de fotolibros que vale —sangrado, área segura— es aritmética, se porta fácil |
| 2 | ¿Nombre del paquete? | `@repo/design-studio` |
| 3 | ¿El catálogo de plantillas públicas de diplomas se comparte? | Sí, pero **después**: son 3.700 líneas de plantillas de diploma que no le sirven al carnet |

## 9. Proyectos separados

Esto y el carnet son **dos proyectos con dos specs**:

1. **El módulo de diseño** — este documento
2. **El carnet de socio** — su primer consumidor: variables del socio, QR, emisión, vigencia
   de 2 años, verificación pública y estado en vivo

Se construyen juntos, pero se documentan aparte. Si se mezclan, en tres meses nadie sabe qué
era del módulo y qué del carnet — y eso complica la migración de fotorank, que es el paso
siguiente.
