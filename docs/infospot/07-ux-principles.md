# Info Spot — UX Principles

**Versión:** 1.0  
**Estado:** Principios oficiales de experiencia  
**Alcance:** Solo documentación. No implica cambios de UI ni implementación.

---

## 1. Norte de UX

Info Spot existe para que las personas **descubran, lean y sigan** el ecosistema DNX con claridad.

La experiencia debe ser:

- Rápida de entender
- Cómoda de leer
- Visualmente confiable
- Libre de ruido de producto

**Frase guía:** si el usuario duda si está en un medio o en un panel, la UX falló.

---

## 2. Principios

### 1. Lectura primero

Toda decisión de interfaz se evalúa contra la calidad de lectura.  
Si un elemento no ayuda a encontrar, entender o continuar una historia, sobra.

### 2. Jerarquía honestamente editorial

No todo es igual. Portada, destacados y secundarios deben verse distintos.  
La UX no “democratiza” visualmente el contenido a costa de claridad.

### 3. Fotografía con dignidad

Las imágenes se muestran grandes, nítidas y acreditadas.  
No se usan como thumbnails decorativos ni se tapan con UI.

### 4. Menos UI, más contenido

Preferir tipografía, espacio e imagen antes que controles, chips y paneles.  
La interfaz es infraestructura invisible.

### 5. Claridad > novedad

Patrones predecibles (header, listado, artículo, share).  
La innovación está en la edición y la composición, no en gestos raros.

### 6. Velocidad percibida

Priorizar contenido above-the-fold, estados de carga sobrios y navegación inmediata.  
Una portada bella pero lenta deja de ser bella.

### 7. Respeto al contexto del usuario

Mobile en movimiento, desktop en lectura profunda.  
Misma marca, distinta densidad y controles.

### 8. Continuidad del ecosistema

Los puentes a DNX Suite / álbumes / organizadores deben ser claros y honestos, sin secuestrar la lectura.

### 9. Accesibilidad no negociable

Contraste, foco, teclado, labels, targets táctiles, reduced motion.  
Un medio moderno es usable por más personas.

### 10. Calma operativa

Errores, vacíos y loadings hablan con tono editorial calmado.  
Nunca alarmismo ni copy de growth hacking.

---

## 3. Heurísticas de decisión

Ante una duda de diseño/UX, preguntar:

1. ¿Esto ayuda a leer o a encontrar?
2. ¿Aumenta la jerarquía o la aplana?
3. ¿Parece medio, blog, dashboard o portal viejo?
4. ¿Funciona sin hover y en 360px?
5. ¿El crédito / la meta / el CTA son honestos?
6. ¿Se puede quitar sin perder comprensión?

Si la respuesta a (6) es sí, quitar.

---

## 4. Flujos clave

### Descubrimiento → lectura

Home/Categoría/Búsqueda → Card/Hero → Artículo  
**Éxito:** el usuario entiende de qué trata en < 3 segundos y entra a leer.

### Lectura → continuidad

Artículo → Relacionados / Categoría / Organizador / Share  
**Éxito:** siguiente paso natural sin popups agresivos.

### Tiempo → evento

Agenda → Evento → Cobertura / Organizador  
**Éxito:** fecha, lugar y sentido del evento claros de inmediato.

### Persona → obra

Fotógrafo/Organizador → Gallery/Eventos/Notas  
**Éxito:** identidad humana + evidencia de trabajo.

---

## 5. Contenido y microcopy UX

| Situación | Dirección |
| --- | --- |
| CTA de lectura | “Leer nota”, “Ver cobertura” |
| Agenda | “Ver evento”, “Ver agenda” |
| Vacío | Explicar + ofrecer alternativa |
| Error | Qué pasó + qué hacer |
| Share | “Compartir” / “Copiar enlace” |
| Externo | Indicar salida cuando importe |

Evitar: “Click aquí”, “Descubrí más magia”, countdowns falsos, urgency traps.

---

## 6. Interacción

- Feedback inmediato en acciones (hover/focus/pressed/toast).
- No interrumpir lectura con modales.
- Share disponible sin tapar el cuerpo.
- Filtros reversibles y visibles (chips activos).
- Scroll restoration predecible en back navigation.

---

## 7. Accesibilidad (mínimos)

- Contraste AA (AAA deseable en cuerpo).
- `focus-visible` consistente (accent).
- Orden de tab lógico.
- Imágenes con `alt` útil; decorativas marcadas.
- Botones/iconos con nombre accesible.
- Formularios con label/error asociados.
- No transmitir información solo con color.
- Respetar reduced motion.

---

## 8. Anti-patrones UX

- Infinite scroll sin forma de llegar al footer/navegación.
- Autoplay con sonido.
- Interstitials de newsletter al primer scroll.
- Mega-menús densos estilo portal.
- Parallax que desplaza el texto de lectura.
- Skeletons eternos sin timeout/error.
- Cards clickeables con botones internos conflictivos sin hit area clara.
- “Seguir leyendo” que corta párrafos de forma artificial en web.

---

## 9. Métricas de experiencia (guía)

No son KPIs de vanidad; sirven para validar UX:

| Señal | Lectura |
| --- | --- |
| Tiempo a primera interacción de lectura | ¿La portada es clara? |
| Scroll depth en artículo | ¿La lectura sostiene? |
| CTR de hero vs cards | ¿La jerarquía funciona? |
| Uso de búsqueda/agenda | ¿Wayfinding suficiente? |
| Bounce inmediato en mobile | ¿Performance/claridad? |
| Errores de share/copy | ¿Feedback OK? |

> **Punto abierto:** definir set mínimo de analytics respetuoso con privacidad.

---

## 10. Criterio de aceptación UX (por pantalla)

Una pantalla se aprueba si:

1. Se entiende el propósito en el primer viewport.
2. No parece dashboard/blog/template.
3. La foto y el texto tienen jerarquía clara.
4. Hay un siguiente paso obvio.
5. Es usable en mobile y desktop.
6. Cumple accesibilidad mínima.

---

## Documentos relacionados

- `02-editorial-language.md` — sensación  
- `05-layouts.md` — estructuras  
- `06-responsive.md` — reglas por dispositivo  
- `08-roadmap-ui.md` — priorización  
