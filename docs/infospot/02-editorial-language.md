# Info Spot — Editorial Language

**Versión:** 1.0  
**Estado:** Guía oficial de lenguaje editorial y sensación de marca  
**Alcance:** Solo documentación. No implica cambios de UI ni implementación.

---

## 1. Cómo se siente Info Spot

Info Spot debe sentirse como un **medio digital moderno**: luminoso, fotográfico, calmado y confiable.

Al entrar, el lector debería percibir:

- Que hay una historia importante, no un listado de widgets.
- Que la fotografía tiene valor editorial.
- Que el espacio está pensado, no “vacío por falta de contenido”.
- Que la marca es contemporánea y profesional, sin parecer software.

**Sensación objetivo:** apertura de un medio premium en móvil o desktop — no la de un CMS, un panel ni un blog.

---

## 2. Qué transmite

| Señal | Mensaje |
| --- | --- |
| Jerarquía clara | “Esto es lo que importa ahora.” |
| Foto generosa | “La imagen es parte de la noticia.” |
| Tipografía limpia | “Podés leer con comodidad.” |
| Metadata discreta | “El contexto está, sin gritar.” |
| Navegación simple | “Encontrás sin fricción.” |
| Créditos visibles | “Respetamos a quien cubre el evento.” |

Info Spot transmite **autoridad editorial + cercanía humana**. Habla del ecosistema DNX con rigor, pero sin frialdad corporativa.

---

## 3. Qué nunca debe transmitir

Info Spot **nunca** debe transmitir:

| Anti-señal | Por qué |
| --- | --- |
| Blog WordPress genérico | Pierde identidad y autoridad |
| Dashboard / SaaS | Confunde medio con producto |
| Portal de noticias antiguo | Densidad, sidebars, banners, ruido |
| Template de magazine | Cards idénticas, jerarquía plana |
| Feed social | Scroll infinito sin edición |
| Marketplace | Prioriza compra sobre lectura |
| Clickbait | Rompe confianza |
| Corporativo vacío | Textos de marca sin contenido real |

Si una pantalla parece “admin con skin editorial”, está fuera de lenguaje.

---

## 4. Filosofía editorial

### Principios

1. **Editar es elegir.** No todo tiene el mismo peso. Portada, destacados y secundarios existen.
2. **La foto cuenta.** Si hay cobertura visual, se muestra con dignidad y tamaño.
3. **Leer es el producto.** La UI sirve a la lectura, no al revés.
4. **Menos ruido, más señal.** Cada elemento debe justificar su presencia.
5. **El ecosistema es el territorio.** Noticias, eventos, organizadores y fotógrafos forman un mismo mundo narrativo.
6. **Respeto al crédito.** Autor, fotógrafo, organizador y fuente son parte del relato.

### Criterios de publicación visual

- Un destacado principal por viewport de portada.
- Secciones con un solo propósito.
- Listados secundarios más densos, nunca compitiendo con el hero.
- CTAs editoriales (leer, ver agenda) por encima de CTAs comerciales, salvo contextos explícitos de álbum/comercio.

---

## 5. Jerarquía visual

### Orden de lectura esperado (home)

1. Marca (logo) + navegación  
2. Hero / historia principal (foto + titular)  
3. Destacados secundarios  
4. Secciones temáticas / categorías  
5. Agenda / cobertura reciente  
6. Cierre editorial (newsletter, quiénes somos, footer)

### Orden de lectura esperado (artículo)

1. Categoría / breadcrumb  
2. Titular  
3. Dek / lead  
4. Metadata (fecha, autor, lectura)  
5. Imagen principal + crédito  
6. Cuerpo  
7. Galería / embeds (si aplica)  
8. Relacionados / share / CTA suave

### Reglas de jerarquía

- Un solo elemento “display” dominante por sección.
- Metadata siempre subordinada al titular.
- El acento de color no compite con la foto.
- Separadores hairline antes que cajas pesadas.
- Evitar más de un CTA primario visible a la vez en el primer viewport.

---

## 6. Importancia de la fotografía

La fotografía no es “media asset”: es **voz editorial**.

### Roles de la imagen

| Rol | Función |
| --- | --- |
| Hero | Define el clima de la historia |
| Photo card | Invita a entrar por la imagen |
| Inline | Apoya un momento del relato |
| Gallery | Extiende la cobertura |
| Portrait | Humaniza organizador / fotógrafo |

### Estándares editoriales

- Preferir imágenes reales del evento o del ecosistema.
- Mantener créditos legibles y consistentes.
- No tapar rostros, acción o sujeto con UI.
- No usar overlays decorativos (badges flotantes, stickers, gradientes agresivos) sobre heroes.
- Aspect ratios coherentes por contexto (ver foundations / components).

Si una historia no tiene foto fuerte, la tipografía y el espacio deben sostener la jerarquía — no rellenar con placeholders ruidosos.

---

## 7. Importancia del espacio en blanco

El espacio en blanco en Info Spot es **estructura**, no ausencia.

### Para qué sirve

- Separar historias.
- Dar peso al titular.
- Dejar respirar la fotografía.
- Evitar sensación de portal saturado.
- Guiar el ojo sin líneas ni cajas innecesarias.

### Cómo usarlo

- Márgenes generosos en contenedores editoriales.
- Padding vertical amplio entre secciones (`lg` / `xl`).
- Agrupar metadata cerca del titular; alejar bloques no relacionados.
- En móvil, no compensar falta de ancho con densidad excesiva: priorizar stack claro.

### Anti-patrones

- Rellenar huecos con cards, banners o widgets.
- Reducir márgenes para “meter más noticias”.
- Usar fondos de color en cada bloque (crea ruido de dashboard).

---

## 8. Experiencia de lectura

### Objetivos

- Entrar rápido a la historia.
- Leer sin fatiga.
- Entender contexto (quién, cuándo, dónde) sin fricción.
- Continuar a historias relacionadas de forma natural.
- Compartir con facilidad, sin interrupciones.

### Parámetros de lectura

| Aspecto | Dirección |
| --- | --- |
| Medida del cuerpo | ~60–75 caracteres (aprox. `article-max` 720px) |
| Interlineado | Generoso (`~1.7`) |
| Contraste texto | Alto sobre fondo claro |
| Distracciones | Mínimas en el cuerpo (sin sidebars densas) |
| Tipografía | Estable, sin efectos |
| Scroll | Continuo y predecible; sin traps |

### Momentos de la experiencia

1. **Descubrimiento** (home / categoría / búsqueda): jerarquía y foto.  
2. **Compromiso** (apertura del artículo): titular + dek + imagen.  
3. **Inmersión** (cuerpo): tipografía, ritmo, imágenes inline.  
4. **Continuidad** (relacionados / agenda / share): siguiente paso claro, no agresivo.

### Microcopy de lectura

- Preferir verbos simples: “Leer nota”, “Ver evento”, “Abrir agenda”.
- Evitar urgencia falsa: “¡No te lo pierdas!” / “Última oportunidad”.
- Estados vacíos: honestos (“Todavía no hay notas en esta categoría”).

---

## 9. Voz escrita (resumen operativo)

| Elemento | Guía |
| --- | --- |
| Titular | Concreto, sin clickbait, con sujeto claro |
| Dek | Amplía sin repetir el titular |
| Caption | Describe o acredita; no vende |
| CTA | Útil y corto |
| Error | Calmo y accionable |

---

## Documentos relacionados

- `01-brand-book.md` — identidad y uso de marca  
- `05-layouts.md` — composición por tipo de página  
- `07-ux-principles.md` — principios de experiencia  
